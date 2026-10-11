'use strict';
const { Model } = require('sequelize');

// Treatment planned (or done) on one tooth. `billId` is set once the
// treatment has been put on an estimate.
module.exports = (sequelize, DataTypes) => {
  class ToothTreatment extends Model {
    static associate(models) {
      ToothTreatment.belongsTo(models.Patient, { foreignKey: 'patientId', onDelete: 'CASCADE' });
      ToothTreatment.belongsTo(models.Bill, { foreignKey: 'billId', constraints: false });
    }
  }

  ToothTreatment.init({
    patientId:  { type: DataTypes.INTEGER, allowNull: false },
    tooth:      { type: DataTypes.STRING(2), allowNull: false },
    serviceId:  { type: DataTypes.INTEGER },
    name:       { type: DataTypes.STRING, allowNull: false },
    price:      { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    status:     { type: DataTypes.STRING, allowNull: false, defaultValue: 'Planned' }, // 'Planned' | 'Done'
    note:       { type: DataTypes.TEXT },
    billId:     { type: DataTypes.INTEGER },
    doneAt:     { type: DataTypes.DATEONLY },
    recordedBy: { type: DataTypes.STRING },
  }, { sequelize, modelName: 'ToothTreatment' });

  return ToothTreatment;
};
