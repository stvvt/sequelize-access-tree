'use strict';

module.exports = function (sequelize, DataTypes) {
	let Reference = sequelize.define('Reference', {
		name: DataTypes.STRING
	}, {
		classMethods: {
			associate: function () {
				this.hasMany(sequelize.models.Grant);
			},

			/**
			 * Extract the entire tree below the specified reference along with grants for userId
			 *
			 * @param {number} id reference id
			 * @param {number} userId
			 * @param {boolean} recursive TRUE - dig down to the leaves; FALSE - direct descendants only
			 */
				*getChildren(id, userId, recursive) {
				recursive = (typeof recursive === 'undefined') ? true : !!recursive;

				let tree = yield this.find({
					where: {
						id: id
					},
					include: [{
						association: this.associations.descendents,
						hierarchy: true,
						include: {
							association: this.associations.Grants,
							where: {
								userId: userId,
								$or: {
									role: {$ne: '$$inherited'},
									inheritedCount: {$gt: 0}
								}
							}
						}
					}, {
						association: this.associations.Grants,
						where: {
							userId: userId,
							$or: {
								role: {$ne: '$$inherited'},
								inheritedCount: {$gt: 0}
							}
						}
					}],
					logging: console.log
				});

				broadcastGrantsToChildren.apply(tree);

				if (!recursive) {
					tree.children = tree.dataValues.children = tree.children.map(function (c) {
						c.dataValues.children = c.children = undefined;
						return c;
					});
				}

				return tree;
			},

			*grant(grantData) {
				let grant = yield sequelize.models.Grant.findOrCreate({
					defaults: grantData,
					where: grantData
				});
				let grantCreated = grant[1];

				if (grantCreated) {
					// Update ancestor inherit counters
					yield updateInheritCounts.call(this, grantData.ReferenceId, grantData.userId, +1);
				}
			},

			*revoke(grantData) {
				let revokedCount = yield sequelize.models.Grant.destroy({
					where: grantData
				});

				if (revokedCount > 0) {
					// Update ancestor inherit counters
					yield updateInheritCounts.call(this, grantData.ReferenceId, grantData.userId, -1);
				}
			}
		}
	});

	Reference.isHierarchy();

	return Reference;

	function* updateInheritCounts(referenceId, userId, offset) {
		let hierarchy = this.hierarchy,
			ReferenceAncestors = this.associations[hierarchy.ancestorsAs].through.model,
			Grant = this.associations.Grants.target,
			throughKey = hierarchy.throughKey,
			throughForeignKey = hierarchy.throughForeignKey,
			where = {},
			self = this;

		where[throughKey] = referenceId;

		// Decrement inheritedCount of all grants of grantData.ReferenceId's ancestors for grantData.UserId
		let ancestors = yield ReferenceAncestors.findAll({
			where: where,
			attributes: [throughForeignKey]
		});
		let ancestorIds = ancestors.map(r => r.ancestorId);

		for (let i = 0; i < ancestorIds.length; i++) {
			try {
				yield Grant.create({
					ReferenceId: ancestorIds[i],
					userId: userId,
					role: '$$inherited',
					inheritedCount: 1,
					logging: console.log
				});
			} catch (e) {
				yield Grant.update({
					inheritedCount: self.sequelize.literal('"inheritedCount" + ' + offset)
				}, {
					where: {
						ReferenceId: ancestorIds[i],
						userId: userId,
						role: '$$inherited'
					},
					logging: console.log
				});
			}
		}
	}

	/**
	 * Populate inherited roles down the tree
	 *
	 * @returns {Array.<string>}
	 */
	function reduceTree() {
		let childrenGrants = this.Grants;

		if (this.children) {
			this.children = this.children.filter(node => {
				// Every node inherits its parent's grants
				node.Grants = node.Grants.concat(
					this.Grants.map(grant => {
						let inherited = Reference.sequelize.models.Grant.build(grant.dataValues);
						inherited.inherited = true;
						return inherited;
					})
				);
				let cg = node.Grants.concat(reduceTree.apply(node));

				childrenGrants = childrenGrants.concat(cg);

				return cg.length > 0;
			});
		}

		return childrenGrants;
	}

	function broadcastGrantsToChildren() {
		if (!this.children) {
			return;
		}

		let selfGrants = this.Grants
			.filter(grant => grant.role !== '$$inherited')
			.map(grant => {
				let inherited = Reference.sequelize.models.Grant.build(grant.dataValues);
				inherited.inherited = true;
				return inherited;
			});

		this.children.forEach(function (child) {
			child.Grants = (child.Grants || []).concat(selfGrants)
			broadcastGrantsToChildren.call(child)
		});
	}
};