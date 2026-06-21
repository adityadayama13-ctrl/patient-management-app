'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Bill extends Model {
    static associate(models) {
      Bill.belongsTo(models.Patient,       { foreignKey: 'patientId' });
      Bill.belongsTo(models.Appointment,   { foreignKey: 'appointmentId', constraints: false });
      Bill.belongsTo(models.MedicalRecord, { foreignKey: 'medicalRecordId', constraints: false });
      Bill.hasMany(models.PaymentLog,      { foreignKey: 'billId', as: 'payments' });
    }
  }

  Bill.init({
    patientId:       { type: DataTypes.INTEGER, allowNull: false },
    appointmentId:   { type: DataTypes.INTEGER },
    medicalRecordId: { type: DataTypes.INTEGER },
    billDate:        { type: DataTypes.DATEONLY, allowNull: false },
    type:            { type: DataTypes.ENUM('Estimate', 'Invoice'), defaultValue: 'Invoice' },
    status:          { type: DataTypes.ENUM('Draft', 'Unpaid', 'Partial', 'Paid'), defaultValue: 'Unpaid' },
    items:           { type: DataTypes.JSON, defaultValue: [] }, // [{ description, amount }]
    notes:           { type: DataTypes.TEXT },
  }, { sequelize, modelName: 'Bill' });

  return Bill;
};
