import React, {Component, PropTypes} from 'react';
import classNames from 'classnames';

import { Modal } from 'react-bootstrap';

import Glyphicon from '../common/atomicDisplayItems/Glyphicon';

export default class ShellCommandLauncher extends Component {

  static propTypes = {
    shellCommandResponse: PropTypes.shape({
      timestamp: PropTypes.number
    }),
    commandHistory: PropTypes.arrayOf(PropTypes.shape({
      shellRequest: PropTypes.shape({
        timestamp: PropTypes.number
      }).isRequired,
      shellUpdates: PropTypes.arrayOf(PropTypes.shape({
        updateType: PropTypes.string,
        outputFilename: PropTypes.string
      }))
    })),
    taskFiles: PropTypes.object,
    updateTask: PropTypes.func.isRequired,
    updateFiles: PropTypes.func.isRequired,
    close: PropTypes.func.isRequired
  }

  constructor() {
    super();
    this.state = {
      commandAcked: false,
      commandStarted: false,
      commandFileExists: false,
      outputFilename: null,
      commandFailed: false,
      commandFailedMessage: null
    };
  }

  componentDidMount() {
    this.props.updateTask();
    this.taskInterval = setInterval(() => {
      this.props.updateTask();
    }, 1000);
  }

  componentWillReceiveProps(nextProps) {
    const timestamp = nextProps.shellCommandResponse.timestamp;
    const cmdStatus = _.find(nextProps.commandHistory, (commandHistoryItem) => commandHistoryItem.shellRequest.timestamp === timestamp);
    if (!cmdStatus || !cmdStatus.shellUpdates) return;
    const failedStatus = _.find(cmdStatus.shellUpdates, (shellUpdate) => shellUpdate.updateType === 'FAILED' || shellUpdate.updateType === 'INVALID');
    const ackedStatus = _.find(cmdStatus.shellUpdates, (shellUpdate) => shellUpdate.updateType === 'ACKED');
    this.setState({
      commandAcked: !!ackedStatus,
      commandStarted: !!_.find(cmdStatus.shellUpdates, (shellUpdate) => shellUpdate.updateType === 'STARTED'),
      commandFailed: !!failedStatus,
      commandFailedMessage: failedStatus && failedStatus.message
    });
    if (ackedStatus) {
      this.outputFilename = ackedStatus.outputFilename;
    }
  }

  componentWillUpdate(nextProps, nextState) {
    if (nextState.commandFailed) {
      clearInterval(this.taskInterval);
    }
    if (nextState.commandFileExists) {
      clearInterval(this.fileInterval);
    }

    if (!this.state.commandAcked && !this.state.commandStarted && nextState.commandAcked && nextState.commandStarted) {
      clearInterval(this.taskInterval);
      const cmdStatus = _.find(nextProps.commandHistory, (commandHistoryItem) => commandHistoryItem.shellRequest.timestamp === this.props.shellCommandResponse.timestamp);
      const outputFilePath = _.find(cmdStatus.shellUpdates, (shellUpdate) => shellUpdate.updateType === 'ACKED').outputFilename;
      const taskId = _.first(cmdStatus.shellUpdates).shellRequestId.taskId.id;
      this.fileInterval = setInterval(() => {
        const directory = this.props.taskFiles[`${taskId}/${taskId}`].data;
        if (_.find(directory.files, (file) => file.name === outputFilePath)) {
          clearInterval(this.fileInterval);
          app.router.navigate(`task/${taskId}/tail/${taskId}/${outputFilePath}`, {trigger: true});
        } else {
          this.props.updateFiles(taskId, taskId);
        }
      }, 1000);
    }
  }

  componentWillUnmount() {
    clearInterval(this.taskInterval);
    clearInterval(this.fileInterval);
  }

  stepStatus(state, text) {
    return (
      <li className={classNames({'complete text-success': state}, {'waiting': !state})}>
        {!state ? <div className="page-loader loader-small" /> : <Glyphicon iconClass="ok" />} {text}...
      </li>
    );
  }

  renderStatusList() {
    return (
      <ul className="status-list">
        {this.stepStatus(this.state.commandAcked, 'Command acknowledged')}
        {this.stepStatus(this.state.commandStarted, 'Command started')}
        {this.stepStatus(this.state.commandFileExists, 'Output file exists')}
      </ul>
    );
  }

  render() {
    return (
      <Modal show={true} onHide={this.props.close} bsSize="small" backdrop="static">
        <Modal.Header closeButton={true}>
            <Modal.Title>Redirecting to output</Modal.Title>
          </Modal.Header>
        <Modal.Body>
          <div className="constrained-modal">
            {this.renderStatusList()}
            {this.state.commandFailed && (
              <p className="text-danger">
                <Glyphicon iconClass="remove" /> Command failed: {this.state.commandFailedMessage}
              </p>
            )}
          </div>
        </Modal.Body>
      </Modal>
    );
  }
}
