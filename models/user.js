'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {}

  User.init({
    name:         { type: DataTypes.STRING, allowNull: false },
    username:     { type: DataTypes.STRING, allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING, allowNull: false },
    role:         { type: DataTypes.ENUM('Admin', 'Doctor', 'Receptionist', 'Nurse'), allowNull: false },
    active:       { type: DataTypes.BOOLEAN, defaultValue: true },
  }, { sequelize, modelName: 'User' });

  return User;
};
