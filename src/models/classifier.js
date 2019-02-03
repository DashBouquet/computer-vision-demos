import * as tf from '@tensorflow/tfjs';

class ClassifierApi {
  constructor(config) {
    this.hostname = config.hostname;
    this.useMobileNet = config.useMobileNet;
    this.mobilenet = false;
    this.classifier = false;
  }
  async loadModel(modelName) {
    if (this.useMobileNet) await this.loadMobileNet();
    await this.loadClassifier(modelName);
  }

  async idbModelExists(modelName) {
    const modelsInfo = await tf.io.listModels();
    console.log(Object.keys(modelsInfo));
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

      const mobilenet = await this.fetchModel('mobileNet');
      const layer = mobilenet.getLayer('conv_pw_13_relu');
      this.mobilenet = tf.model({
        inputs: mobilenet.inputs,
        outputs: layer.output
      });

      console.log('mobileNet loaded');
    } catch (e) {
      throw new Error(e);
    }
  }

  async loadClassifier(modelName) {
    try {
      const model = await this.fetchModel(modelName);
      this.classifier = model;
      console.log('classifier loaded');
    } catch (e) {
      throw new Error(e);
    }
  }

  async fetchModel(modelName) {
    const modelExists = await this.idbModelExists(modelName);

    if (modelExists) {
      console.log(`Loading ${modelName} from IDB`);
      const model = await tf.loadModel(`indexeddb://${modelName}`);
      return model;
    } else {
      console.log(`Loading ${modelName} from local server`);
      const model = await tf.loadModel(
        `${this.hostname}/nnModels/${modelName}/model.json`
      );

      model
        .save(`indexeddb://${modelName}`)
        .then(() => console.log(`${modelName} saved to IDB`))
        .catch((err) => console.warn(err));
      return model;
    }
  }

  async classifyImage(imageData) {
    if (!this.classifier || (this.useMobileNet && !this.mobilenet))
      return false;

    let input = await this.normalizeImage(imageData);

    const predictedClass = await this.predict(input);
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

  async predict(input) {
    const predictedClass = tf.tidy(() => {
      if (this.useMobileNet) input = this.mobilenet.predict(input);
      const predictions = this.classifier.predict(input);

      return predictions.as1D();
    });

    let palmConfidence = await predictedClass.data();
    predictedClass.dispose();

    return palmConfidence[1];
  }
}

export default ClassifierApi;
