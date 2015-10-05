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
			getChildren: function* getChildren(id, userId, recursive) {
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
							required: false,
							where: {
								userId: userId
							}
						}
					}, {
						association: this.associations.Grants,
						required: false,
						where: {
							userId: userId
						}
					}],
					logging: console.log
				});

				reduceTree.apply(tree);

				if (!recursive) {
					tree.children = tree.dataValues.children = tree.children.map(function (c) { c.dataValues.children = c.children = undefined; return c; });
				}

				return tree.children;
			}
		}
	});

	Reference.isHierarchy();

	return Reference;

	/**
	 * Populate inherited roles down the tree
	 *
	 * @param root
	 * @returns {Array.<T>|string|Buffer|*}
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
};