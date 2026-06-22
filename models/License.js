'use strict';
module.exports = (sequelize, DataTypes) => {
  return sequelize.define('License', {
    licensedTo:    { type: DataTypes.STRING },
    referenceCode: { type: DataTypes.STRING },
    startDate:     { type: DataTypes.DATEONLY },
    expiryDate:    { type: DataTypes.DATEONLY },
    features:      { type: DataTypes.JSONB, defaultValue: {} },
  });
};
