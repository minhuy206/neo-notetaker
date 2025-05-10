import fs from 'fs'
import speech from '@google-cloud/speech'

process.env.GOOGLE_APPLICATION_CREDENTIALS = 'key.json'
async function transcribeAudio(audioName) {
  try {
    const speechClient = new speech.SpeechClient()
    const file = fs.readFileSync(audioName)
    const audioBytes = file.toString('base64')

    const audio = {
      content: audioBytes
    }

    const config = {
      encoding: 'WEBM_OPUS',
      sampleRateHertz: 48000,
      languageCode: 'en-US',
      audioChannelCount: 2,
      enableSeparateRecognitionPerChannel: false
    }

    return new Promise((resolve, reject) => {
      speechClient
        .recognize({ audio, config })
        .then((data) => {
          resolve(data)
        })
        .catch((err) => {
          reject(err)
        })
    })
  } catch (error) {
    console.error('Error:', error)
  }
}

export default transcribeAudio
