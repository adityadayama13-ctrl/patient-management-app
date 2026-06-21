'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Appointment extends Model {
    static associate(models) {
      Appointment.belongsTo(models.Patient, { foreignKey: 'patientId' });
    }
  }

  Appointment.init({
    patientId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    reason: {
      type: DataTypes.STRING,
    },
    notes: {
      type: DataTypes.TEXT,
    },
    status: {
      type: DataTypes.ENUM('Scheduled', 'Completed', 'Cancelled'),
      defaultValue: 'Scheduled',
    },
  }, {
    sequelize,
    modelName: 'Appointment',
  });

  return Appointment;
};
