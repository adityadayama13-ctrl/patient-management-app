'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class MedicalRecord extends Model {
    static associate(models) {
      MedicalRecord.belongsTo(models.Patient, { foreignKey: 'patientId' });
    }
  }

  MedicalRecord.init({
    patientId:         { type: DataTypes.INTEGER, allowNull: false },
    visitDate:         { type: DataTypes.DATEONLY, allowNull: false },
    doctorName:        { type: DataTypes.STRING },
    chiefComplaint:    { type: DataTypes.TEXT },
    diagnosis:         { type: DataTypes.TEXT },
    prescription:      { type: DataTypes.TEXT },
    treatmentPlanned:  { type: DataTypes.TEXT },
    treatmentDone:     { type: DataTypes.TEXT },
    vitalsBP:          { type: DataTypes.STRING },   // e.g. "120/80"
    vitalsWeight:      { type: DataTypes.STRING },   // e.g. "72 kg"
    vitalsTemp:        { type: DataTypes.STRING },   // e.g. "98.6 °F"
    followUpDate:      { type: DataTypes.DATEONLY },
    clinicalNotes:     { type: DataTypes.TEXT },
  }, {
    sequelize,
    modelName: 'MedicalRecord',
  });

  return MedicalRecord;
};
