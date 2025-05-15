import { Storage } from '@google-cloud/storage'
import 'dotenv/config'
const storage = new Storage(
  process.env.GOOGLE_CLOUD_PROJECT_ID,
  process.env.GOOGLE_CLOUD_KEY_FILE
)
function uploadFileToGCS(bucketName, filePath, destination) {
  try {
    return storage.bucket(bucketName).upload(filePath, {
      destination: destination,
      gzip: true
    })
  } catch (error) {
    console.error('Error uploading file to GCS:', error)
  }
}

export const googleCloudStorageService = {
  uploadFileToGCS
}
