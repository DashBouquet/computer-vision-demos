import React, { Component } from 'react';
import ClassifierApi from './models/classifier';
import Frozen from './models/frozen';
import './App.css';

import models from './Models';

const argMax = (array) => array.map((x, i) => [x, i]).reduce((r, a) => (a[0] > r[0] ? a : r))[1];

const toPercent = (score) => (score * 100).toFixed(2);

const getModelsPath = () => process.env.NODE_ENV === 'production' ? 'https://dashbouquet.github.io/computer-vision-demos/models/' : `models`;

class App extends Component {
  constructor() {
    super();

    // Config
    this.snapsPerSecond = 3;
    this.predictionsPerSecond = 10;
    this.predictionQueueCap = 5;
    this.listenKeys = true;

    this.state = {
      classifier: false,
      gestIndex: 0,
      predIndex: [],
      model: models[0]
    };

    this.gestureLoading = false;
    this.gestureLast = Date.now();
    this.snapLast = Date.now();
    this.saveSnaps = null;
    this.snapsInProcessing = 0;

    this.snapShot = this.snapShot.bind(this);
    this.classifyBox = this.classifyBox.bind(this);
  }

  setup(video, cnv) {
    const [width, height] = [window.innerWidth, window.innerHeight];
    const webcamRatio = video.videoWidth / video.videoHeight;
    const aspectRatio = width / height;

    if (webcamRatio > aspectRatio) {
      cnv.width = width;
      cnv.height = width / webcamRatio;
      cnv.style.top = 0 - (cnv.height / 2 - height / 2);
    } else {
      cnv.height = height;
      cnv.width = height * webcamRatio;
      cnv.style.left = 0 - (cnv.width / 2 - width / 2);
    }
  }

  webCamLoaded(stream) {
    this.video = document.createElement('video');
    this.video.srcObject = stream;
    this.video.style.display = 'none';
    document.body.appendChild(this.video);

    this.video.onloadedmetadata = (e) => {
      this.setup(this.video, this.cvs);
      this.video.play();
      this.snapShot();
    };
  }

  async snapShot() {
    if (this.ctx) {
      this.updateDetectBoxes();
      if (this.state.classifier) {
        this.classifyBox();
      }
    }

    requestAnimationFrame(this.snapShot);
  }

  printScore(score) {
    console.log(
      `%c${(score * 100).toFixed(2)}% (${this.snapsInProcessing})`,
      'margin-left: 15px; color: blue; font-size:15px; background: white; padding: 5px; border-radius: 5px;'
    );
  }

  classifyBox() {
    if (
      !this.gestureLoading &&
      Date.now() - this.gestureLast > 1000 / this.predictionsPerSecond &&
      this.snapsInProcessing < this.predictionQueueCap
    ) {
      this.snapsInProcessing++;
      this.gestureLoading = true;
      this.gestureLast = Date.now();
      this.state.classifier.classifyImage(this.outCnv).then((res) => {
        this.snapsInProcessing--;
        this.gestureLoading = false;
        this.setState({ predIndex: res });
      });
    }
  }

  updateDetectBoxes() {
    const boxSize = window.innerHeight / 2;
    const border = 5;
    this.ctx.drawImage(this.video, 0, 0, this.cvs.width, this.cvs.height);

    this.ctx.strokeStyle = '#0F0';
    this.ctx.lineWidth = border;
    this.ctx.rect(
      (this.cvs.width - boxSize - border) / 2,
      (this.cvs.height - boxSize - border) / 2,
      boxSize + border,
      boxSize + border
    );
    this.ctx.stroke();

    this.outCtx.drawImage(
      this.cvs,
      (this.cvs.width - boxSize) / 2,
      (this.cvs.height - boxSize) / 2,
      boxSize,
      boxSize,
      0,
      0,
      224,
      224
    );
  }

  captureWebcam() {
    if (navigator.mediaDevices) {
      return navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => stream);
    } else {
      return Promise.reject(
        new Error(
          'Native web camera streaming (getUserMedia) not supported in this browser.'
        )
      );
    }
  }

  handleKeyPress = (event) => {
    if (this.listenKeys && this.saveSnaps !== event.key) {
      this.saveSnaps = event.key;
      console.log(`Saving images of ${event.key} class`);
    }
  };

  handleKeyPressUp = (event) => {
    this.saveSnaps = null;
  };

  componentWillUpdate(nextProps, nextState) {
    if (nextState.model.modelName !== this.state.model.modelName) {
      this.loadClassifier(nextState.model.modelName);
    }
  }

  componentDidMount() {
    [this.cvs.width, this.cvs.height] = [window.innerWidth, window.innerHeight];
    this.ctx = this.cvs.getContext('2d');

    document.body.addEventListener('keydown', this.handleKeyPress, false);
    document.body.addEventListener('keyup', this.handleKeyPressUp, false);

    this.loadClassifier();

    this.captureWebcam().then((objectUrl) => {
      this.webCamLoaded(objectUrl);
    });

    this.outCtx = this.outCnv.getContext('2d');
  }

  loadFrozen() {
    const frozen = new Frozen();
    frozen.init().then(() => {
      this.setState({ classifier: frozen });
    });
  }

  loadClassifier(model) {
    const classifier = new ClassifierApi({
      hostname: getModelsPath(),
      useMobileNet: false
    });

    classifier
      .loadModel(model || this.state.model.modelName )
      .then(() => {
        console.warn('READY TO CLASSIFY');
        this.setState({ classifier });
      })
      .catch((e) => {
        console.log(e);
      });
  }

  render() {
    const model = this.state.model;
    const detections = Array.from(this.state.predIndex) || [];
    const labels = model.labels;
    const currentDetectionIndex = detections.length > 0 ? argMax(detections) : 0;
    const explainer = model.explainers[currentDetectionIndex];
    const changeModel = (modelIndex) => {
      this.setState({model: models[modelIndex]}); 
    }

    return (
      <React.Fragment>
        {this.state.gestIndex === 1 ? (
          <p className="palmDetected">PALM</p>
        ) : null}
          <div className="statsTable">
            {model && detections.map((v, i) => (<div key={i}><div style={{width: `${toPercent(v)}%`, backgroundColor: 'green', whiteSpace: 'nowrap'}}>{labels[i]} {toPercent(v)}%</div></div>))}
          </div>
        <canvas
          tabIndex="0"
          key={'cvsMain'}
          className="canvas"
          ref={(cvs) => {
            this.cvs = cvs;
          }}
        />
        <canvas
          key={'cvsSecondary'}
          className="tmpCanvas"
          ref={(outCnv) => {
            this.outCnv = outCnv;
          }}
          width="224"
          height="224"
        />
        {model && <img src={`/models/${this.state.model.modelName}/${explainer}`} className="detectionExplainer"/>}
        <select onChange={(evt) => { console.log(evt.target.value); changeModel(evt.target.value) }} className="modelsSwitcher">
          {models.map((model, i) => (<option key={i} value={i}>{model.description}</option>))}
        </select>
      </React.Fragment>
    );
  }
}

export default App;
