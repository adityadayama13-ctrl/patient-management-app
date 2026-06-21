'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class LabResult extends Model {
    static associate(models) {
      LabResult.belongsTo(models.Patient, { foreignKey: 'patientId' });
    }
  }

  LabResult.init({
    patientId:      { type: DataTypes.INTEGER, allowNull: false },
    testDate:       { type: DataTypes.DATEONLY, allowNull: false },
    labName:        { type: DataTypes.STRING },
    testName:       { type: DataTypes.STRING, allowNull: false },
    parameters:     { type: DataTypes.JSONB, defaultValue: [] },
    notes:          { type: DataTypes.TEXT },
    attachmentPath: { type: DataTypes.STRING },
    attachmentName: { type: DataTypes.STRING },
    attachmentType: { type: DataTypes.STRING },
  }, { sequelize, modelName: 'LabResult' });

  return LabResult;
};
