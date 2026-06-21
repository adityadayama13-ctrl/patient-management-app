'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Patient extends Model {
    static associate(models) {
      Patient.hasMany(models.Appointment,    { foreignKey: 'patientId' });
      Patient.hasMany(models.MedicalRecord,  { foreignKey: 'patientId' });
      Patient.hasMany(models.Prescription,   { foreignKey: 'patientId' });
      Patient.hasMany(models.LabResult,      { foreignKey: 'patientId' });
    }
  }

  Patient.init({
    firstName:    { type: DataTypes.STRING,                          allowNull: false },
    lastName:     { type: DataTypes.STRING,                          allowNull: false },
    dateOfBirth:  { type: DataTypes.DATEONLY,                        allowNull: false },
    gender:       { type: DataTypes.ENUM('Male', 'Female', 'Other'), allowNull: false },
    bloodType:    { type: DataTypes.ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-','Unknown') },
    phone:        { type: DataTypes.STRING },
    email:        { type: DataTypes.STRING },
    address:      { type: DataTypes.TEXT },
    emergencyContactName:     { type: DataTypes.STRING },
    emergencyContactPhone:    { type: DataTypes.STRING },
    emergencyContactRelation: { type: DataTypes.STRING },
    allergies:          { type: DataTypes.TEXT },
    currentMedications: { type: DataTypes.TEXT },
    medicalConditions:  { type: DataTypes.TEXT },
  }, {
    sequelize,
    modelName: 'Patient',
  });

  return Patient;
};
