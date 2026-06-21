const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('WhatsappConfig', {
    phoneNumberId:       { type: DataTypes.STRING },
    accessToken:         { type: DataTypes.TEXT },
    followUpTemplate:    { type: DataTypes.STRING, defaultValue: 'follow_up_reminder' },
    birthdayTemplate:    { type: DataTypes.STRING, defaultValue: 'birthday_wish' },
    languageCode:        { type: DataTypes.STRING, defaultValue: 'en' },
    enabled:             { type: DataTypes.BOOLEAN, defaultValue: false },
  }, { tableName: 'WhatsappConfig' });
};
