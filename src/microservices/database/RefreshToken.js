const Sequelize = require('sequelize')
const db = require('../database/db');
const User = require('./User');

const RefreshToken = db.define('refresh_tokens', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
    },
    key: {
        type: Sequelize.TEXT,
        allowNull: false,

    }
}, { underscored: true });

RefreshToken.belongsTo(User, {
    foreignKey: {
        allowNull: false
    }
});
User.hasMany(RefreshToken);

RefreshToken.sync({ alter: true });

module.exports = RefreshToken;