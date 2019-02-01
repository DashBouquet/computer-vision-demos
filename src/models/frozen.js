import * as tf from '@tensorflow/tfjs';
import { loadFrozenModel } from '@tensorflow/tfjs-converter';

class Frozen {
  constructor() {
    this.ASSETS_URL = `http://127.0.0.1:8085/nnModels/`;
    this.MODEL_URL = `${
      this.ASSETS_URL
    }/converted-sessionmodel/tensorflowjs_model.pb`;
    this.WEIGHTS_URL = `${
      this.ASSETS_URL
    }/converted-sessionmodel/weights_manifest.json`;
    this.IMAGE_SIZE = 224;
    this.labels = ['closed', 'opened'];
    this.model = false;
  }

  async loadModel() {
    const model = await loadFrozenModel(this.MODEL_URL, this.WEIGHTS_URL);
    // Warm up GPU
    const input = tf.zeros([1, this.IMAGE_SIZE, this.IMAGE_SIZE, 3]);
    await model.executeAsync({ input }); // MobileNet V1
    //model.predict({ Placeholder: input }) // MobileNet V2

    return model;
  }

  async classifyImage(img) {
    const t0 = performance.now();
    const image = tf.fromPixels(img).toFloat();
    const resized = tf.image.resizeBilinear(image, [
      this.IMAGE_SIZE,
      this.IMAGE_SIZE
    ]);
    const offset = tf.scalar(255 / 2);
    const normalized = resized.sub(offset).div(offset);
    const input = normalized.expandDims(0);
    const output = await tf.tidy(() => this.model.predict({ input })).data(); // MobileNet V1
    //const output = await tf.tidy(() => this.model.predict({ Placeholder: input })).data() // MobileNet V2
    const predictions = this.labels
      .map((label, index) => ({ label, accuracy: output[index] }))
      .sort((a, b) => b.accuracy - a.accuracy);
    const time = `${(performance.now() - t0).toFixed(1)} ms`;
    return { predictions, time };
  }

  async init() {
    this.model = await this.loadModel();
    //const predictions = await this.predict(input)
    //console.log(predictions)
  }
}
export default Frozen;
