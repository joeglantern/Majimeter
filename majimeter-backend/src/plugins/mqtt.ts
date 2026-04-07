import fp from 'fastify-plugin'
import mqtt from 'mqtt'
import type { MqttClient } from 'mqtt'
import type { FastifyInstance } from 'fastify'
import { handleSensorMessage } from '../mqtt/subscriber'

declare module 'fastify' {
  interface FastifyInstance {
    mqtt: MqttClient
  }
}

export default fp(
  async (fastify: FastifyInstance) => {
    const brokerUrl = process.env.MQTT_BROKER_URL!
    const username  = process.env.MQTT_USERNAME  || undefined
    const password  = process.env.MQTT_PASSWORD  || undefined

    const client = mqtt.connect(brokerUrl, {
      username,
      password,
      reconnectPeriod: 5_000,
      connectTimeout:  10_000,
      clientId: `majimeter-backend-${process.pid}`,
    })

    client.on('connect', () => {
      fastify.log.info({ brokerUrl }, 'MQTT connected')

      client.subscribe('sensors/#', (err) => {
        if (err) fastify.log.error({ err }, 'MQTT subscribe failed')
        else fastify.log.info('MQTT subscribed to sensors/#')
      })
    })

    client.on('message', (topic, payload) => {
      // Fire-and-forget — log unhandled rejections centrally
      handleSensorMessage(fastify, topic, payload).catch((err) =>
        fastify.log.error({ err, topic }, 'Error processing MQTT message'),
      )
    })

    client.on('reconnect', () => fastify.log.warn({ brokerUrl }, 'MQTT reconnecting…'))
    client.on('error',     (err) => fastify.log.error({ err }, 'MQTT error'))
    client.on('offline',   ()    => fastify.log.warn('MQTT offline'))

    fastify.decorate('mqtt', client)

    fastify.addHook('onClose', async () => {
      await client.endAsync()
    })
  },
  { name: 'mqtt', dependencies: ['db', 'redis'] },
)
