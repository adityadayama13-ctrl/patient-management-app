'use strict';
const { Model } = require('sequelize');

// A signed-in device. `id` is the SHA-256 of the cookie token, so a copy of
// the database alone can't be used to sign in.
module.exports = (sequelize, DataTypes) => {
  class Session extends Model {
    static associate(models) {
      Session.belongsTo(models.User, { foreignKey: 'userId', onDelete: 'CASCADE' });
    }
  }

  Session.init({
    id:         { type: DataTypes.STRING(64), primaryKey: true },
    userId:     { type: DataTypes.INTEGER, allowNull: false },
    lastSeenAt: { type: DataTypes.DATE, allowNull: false },
  }, { sequelize, modelName: 'Session' });

  return Session;
};
