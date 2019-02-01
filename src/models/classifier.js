import * as tf from '@tensorflow/tfjs';

class ClassifierApi {
  constructor(config) {
    this.hostname = config.hostname;
    this.mobilenet = false;
    this.classifier = false;
  }
  async loadModel(modelName) {
    await this.loadMobileNet();
    await this.loadClassifier(modelName);
  }

  async idbModelExists(modelName) {
    const modelsInfo = await tf.io.listModels();
    console.log(modelsInfo);
    if (Object.keys(modelsInfo).length === 0) return false;

    return (
      Object.keys(modelsInfo).filter((modelPath) => {
        return (
          modelPath.includes('indexeddb') &&
          modelPath.split('://')[1] === modelName
        );
      }).length > 0
    );
  }

  async loadMobileNet() {
    try {
      if (this.mobilenet) this.mobilenet.dispose();

      const modelExists = await this.idbModelExists('mobileNet');

      if (modelExists) {
        console.log('Loading mobileNet from IDB');
        this.mobilenet = await tf.loadModel('indexeddb://mobileNet');
      } else {
        console.log('Loading mobileNet from local server');
        const mobilenet = await tf.loadModel(
          `${this.hostname}/nnModels/mobileNet/mobilenet.json`
        );
        const layer = mobilenet.getLayer('conv_pw_13_relu');
        this.mobilenet = tf.model({
          inputs: mobilenet.inputs,
          outputs: layer.output
        });

        await this.mobilenet.save(`indexeddb://mobileNet`);
      }

      console.log('mobileNet loaded');
    } catch (e) {
      throw new Error(e);
    }
  }

  async loadClassifier(modelName) {
    const modelExists = await this.idbModelExists(modelName);
    if (modelExists) {
      console.log(`Loading ${modelName} from IDB`);
      this.classifier = await tf.loadModel(`indexeddb://${modelName}`);
    } else {
      console.log(`Loading ${modelName} from local server`);
      this.classifier = await tf.loadModel(
        `${this.hostname}/nnModels/${modelName}/model.json`
      );

      this.classifier
        .save(`indexeddb://${modelName}`)
        .then(() => console.log(`${modelName} saved to IDB`))
        .catch((err) => console.warn(err));
    }

    console.log('classifier loaded');
  }

  async classifyImage(imageData) {
    if (!this.classifier || !this.mobilenet) return false;

    const croppedImage = await this.normalizeImage(imageData);
    const predictedClass = await this.predict(croppedImage);
    return predictedClass;
  }

  async normalizeImage(imageData) {
    return tf.tidy(() => {
      const webcamImage = tf.fromPixels(imageData);
      const croppedImage = this.cropImage(webcamImage);

      const batchedImage = croppedImage.expandDims(0);

      return batchedImage
        .toFloat()
        .div(tf.scalar(127))
        .sub(tf.scalar(1));
    });
  }

  cropImage(img) {
    const size = Math.min(img.shape[0], img.shape[1]);
    const centerHeight = img.shape[0] / 2;
    const beginHeight = centerHeight - size / 2;
    const centerWidth = img.shape[1] / 2;
    const beginWidth = centerWidth - size / 2;
    return img.slice([beginHeight, beginWidth, 0], [size, size, 3]);
  }

  async predict(croppedImage) {
    const predictedClass = tf.tidy(() => {
      //const embeddings = this.mobilenet.predict(croppedImage);
      const predictions = this.classifier.predict(croppedImage);

      return predictions.as1D();
    });

    let palmConfidence = await predictedClass.data();
    predictedClass.dispose();

    return palmConfidence[1];
  }
}

export default ClassifierApi;
