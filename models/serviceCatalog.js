'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ServiceCatalog extends Model {
    static associate() {}
  }

  ServiceCatalog.init({
    name:        { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    price:       { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    category:    { type: DataTypes.STRING },
  }, { sequelize, modelName: 'ServiceCatalog' });

  return ServiceCatalog;
};
