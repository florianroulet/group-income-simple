/* globals logger */

import {server, db} from './setup'

// TODO: delete this file
//       See: https://github.com/okTurtles/group-income-simple/issues/81

var Joi = require('joi')
var bcrypt = require('bcrypt')
var uuid = require('node-uuid')
var Promise = require('bluebird')
var compare = Promise.promisify(bcrypt.compare)
var Sequelize = require('Sequelize')

server.route({
  config: {
    validate: {
      payload: {
        email: Joi.string().email().required(),
        password: Joi.string().min(7).max(50).required()
      }
    }
  },
  method: 'POST',
  path: '/session/login',
  handler: function (request, reply) {
    var savedUser = null
    db.User.findOne({where: {email: request.payload.email}})
    .then(function (result) {
      if (result == null) return Promise.reject(new Error('Invalid email or password'))

      savedUser = result.dataValues
      return compare(request.payload.password, savedUser.password)
    })
    .then(function (equals) {
      if (!equals) return Promise.reject(new Error('Invalid email or password'))
      return db.Session.create({id: uuid.v4(), userId: savedUser.id, logout: null})
    })
    .then(function (session) {
      reply({session: session.dataValues})
    })
    .catch(function (err) {
      logger(err)
      reply(err)
    })
  }
})

server.route({
  config: { auth: 'gi-auth' },
  method: 'POST',
  path: '/session/logout',
  handler: function (request, reply) {
    var userId = request.auth.credentials.userId

    db.Session.update({logout: Date.now()}, {where: {userId: userId}})
    .then(function () {
      reply()
    })
    .catch(function (err) {
      logger(err)
      reply(err)
    })
  }
})

db.Session = db.define('Session', {
  id: {type: Sequelize.UUID, primaryKey: true},
  userId: {type: Sequelize.INTEGER, allowNull: false},
  logout: {type: Sequelize.DATE, allowNull: true}
}, {
  freezeTableName: true
})

module.exports = db.Session.sync()
