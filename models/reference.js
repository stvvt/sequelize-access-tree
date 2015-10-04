'use strict';

module.exports = function (sequelize, DataTypes) {
    let Reference = sequelize.define('Reference', {
        name: DataTypes.STRING
    }, {
        classMethods: {
            associate: function () {
                this.hasMany(sequelize.models.Grant);
            },

            getChildren: function* getChildren(id, userId) {
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

                return reduceTree(tree);
            }
        }
    });

    Reference.isHierarchy();

    return Reference;
};

function inheritGrants(root) {
    let childrenGrants = root.Grants;

    if (root.children) {
        root.children = root.children.filter(function (node) {
            node.Grants = node.Grants.concat(
                root.Grants.map(grant => ({
                        role: grant.role,
                        inherited: true
                }))
            );
            let cg = node.Grants.concat(inheritGrants(node));

            childrenGrants = childrenGrants.concat(node.childrenGrants);

            return cg.length > 0;
        });
    }

    return childrenGrants;
}

function reduceTree(root) {
    inheritGrants(root);

    return root;
}