'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Prescription extends Model {
    static associate(models) {
      Prescription.belongsTo(models.Patient, { foreignKey: 'patientId' });
    }
  }

  Prescription.init({
    patientId:   { type: DataTypes.INTEGER, allowNull: false },
    visitDate:   { type: DataTypes.DATEONLY, allowNull: false },
    doctorName:  { type: DataTypes.STRING },
    diagnosis:   { type: DataTypes.TEXT },
    drugs:       { type: DataTypes.JSONB, defaultValue: [] },
    notes:       { type: DataTypes.TEXT },
  }, {
    sequelize,
    modelName: 'Prescription',
  });

  return Prescription;
};
