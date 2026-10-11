'use strict';

// Clinic-wide settings shared by every device, stored as key -> JSON value
// (for example key 'rolePermissions').
module.exports = (sequelize, DataTypes) => {
  return sequelize.define('AppSetting', {
    key:   { type: DataTypes.STRING, primaryKey: true },
    value: { type: DataTypes.JSONB, allowNull: false },
  });
};
