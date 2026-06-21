'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PaymentLog extends Model {
    static associate(models) {
      PaymentLog.belongsTo(models.Bill, { foreignKey: 'billId' });
    }
  }

  PaymentLog.init({
    billId:        { type: DataTypes.INTEGER, allowNull: false },
    paymentDate:   { type: DataTypes.DATEONLY, allowNull: false },
    amount:        { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    method:        { type: DataTypes.ENUM('Cash', 'Card', 'UPI', 'Other'), defaultValue: 'Cash' },
    reference:     { type: DataTypes.STRING }, // cheque no, UPI txn id, etc.
    notes:         { type: DataTypes.TEXT },
  }, { sequelize, modelName: 'PaymentLog' });

  return PaymentLog;
};
