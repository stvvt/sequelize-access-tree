'use strict';

module.exports = function (sequelize, DataTypes) {
	return sequelize.define('Grant', {
		userId: DataTypes.INTEGER,
		role: DataTypes.STRING,
		inheritedCount: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0
		}
	}, {
		classMethods: {
			associate: function () {
				this.belongsTo(sequelize.models.Reference);
			}
		},

		indexes: [{
			unique: true,
			fields: ['ReferenceId', 'userId', 'role']
		}]
	});
};