'use strict';

module.exports = function (sequelize, DataTypes) {
    let Grant = sequelize.define('Grant', {
        userId: DataTypes.INTEGER,
        role: DataTypes.STRING
    }, {
        classMethods: {
            associate: function () {
                this.belongsTo(sequelize.models.Reference);
            }
        }
    });

    return Grant;
}