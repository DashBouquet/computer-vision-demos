import React, { Component } from 'react';
import { createTrainImage } from './models/requests';
import ClassifierApi from './models/classifier';
import Frozen from './models/frozen';
import './App.css';

class App extends Component {
  constructor() {
    super();

    // Config
    this.snapsPerSecond = 3;
    this.predictionsPerSecond = 10;
    this.predictionQueueCap = 5;
    this.listenKeys = false;

    this.state = {
      classifier: false,
      gestIndex: 0
    };

    this.gestureLoading = false;
    this.gestureLast = Date.now();
    this.snapLast = Date.now();
    this.saveSnaps = null;
    this.snapsInProcessing = 0;

    this.snapShot = this.snapShot.bind(this);
    this.classifyBox = this.classifyBox.bind(this);
  }
  webCamLoaded(stream) {
    this.video = document.createElement('video');
    this.video.srcObject = stream;
    this.video.style.display = 'none';
    document.body.appendChild(this.video);

    this.video.onloadedmetadata = (e) => {
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

    window.requestAnimationFrame(this.snapShot);
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
        this.printScore(res);
        const idx = res > 0.5 ? 1 : 0;

        if (
          this.saveSnaps !== null &&
          Date.now() - this.snapLast > 1000 / this.snapsPerSecond
        ) {
          const b64 = this.outCnv.toDataURL('image/jpeg');

          const imageData = {
            data: b64,
            class: this.saveSnaps
          };
          createTrainImage(imageData);
          this.snapLast = Date.now();
        }

        this.setState({ gestIndex: idx });
      });
    }
  }

  updateDetectBoxes() {
    const shift = 400;
    this.ctx.drawImage(this.video, 0, 0, this.cvs.width, this.cvs.height);

    this.ctx.strokeStyle = 'black';
    this.ctx.lineWidth = '1';
    this.ctx.rect(
      this.cvs.width / 2 - shift,
      this.cvs.height / 2 - 200,
      shift,
      shift
    );
    this.ctx.stroke();

    this.outCtx.drawImage(
      this.cvs,
      this.cvs.width / 2 - shift,
      this.cvs.height / 2 - 200,
      shift,
      shift,
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

  loadClassifier() {
    const classifier = new ClassifierApi({
      hostname: 'http://127.0.0.1:8085',
      useMobileNet: false
    });

    classifier
      .loadModel('hands-21-0.99')
      .then(() => {
        console.warn('READY TO CLASSIFY');
        this.setState({ classifier });
      })
      .catch((e) => {
        console.log(e);
      });
  }

  render() {
    return (
      <React.Fragment>
        {this.state.gestIndex === 1 ? (
          <p className="palmDetected">PALM</p>
        ) : null}
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
      </React.Fragment>
    );
  }
}

export default App;
