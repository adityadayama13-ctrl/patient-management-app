'use strict';
const { Model } = require('sequelize');

// One charting entry for one tooth. A tooth's current condition is its most
// recent entry; older entries are its history.
module.exports = (sequelize, DataTypes) => {
  class ToothCondition extends Model {
    static associate(models) {
      ToothCondition.belongsTo(models.Patient, { foreignKey: 'patientId', onDelete: 'CASCADE' });
    }
  }

  ToothCondition.init({
    patientId:  { type: DataTypes.INTEGER, allowNull: false },
    tooth:      { type: DataTypes.STRING(2), allowNull: false },   // FDI number, e.g. "36" or "75"
    condition:  { type: DataTypes.STRING, allowNull: false },      // key from DENTAL_CONDITIONS in dental.js
    note:       { type: DataTypes.TEXT },
    recordedBy: { type: DataTypes.STRING },
  }, { sequelize, modelName: 'ToothCondition' });

  return ToothCondition;
};
