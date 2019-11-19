function createServiceMixin (execlib) {
  'use strict';

  var lib = execlib.lib,
    q = lib.q,
    qlib = lib.qlib,
    execSuite = execlib.execSuite,
    taskRegistry = execSuite.taskRegistry;

  var STATUS_INITIAL = 0,
    STATUS_ERROR = 1,
    STATUS_COMMITED = 2,
    //STATUS_DELIVERED = 3,
    STATUS_ABANDONED = 9;

  var SUBSTATUS_EXPIRED = 1,
    SUBSTATUS_BLACKLISTED = 2;

  function CommunicationHistorySenderServiceMixin (prophash) {
  }
  CommunicationHistorySenderServiceMixin.prototype.destroy = function () {
  };

  CommunicationHistorySenderServiceMixin.prototype.updateCommunicationHistory = execSuite.dependentServiceMethod([], ['History'], function (historysink, id, updateobj, updateparams, defer) {
    qlib.promise2defer(
      historysink.call(
        'update',
        uniquefilterforid(id),
        updateobj,
        updateparams
      )
      ,
      defer
    );
  });
  
  CommunicationHistorySenderServiceMixin.prototype.getMessageToSendFromHistory = function (sender) {
    return this.readFromCommunicationHistory({
      filter: {
        op: 'and',
        filters: [{
          op: 'eq',
          field: 'from',
          value: sender
        },{
          op: 'eq',
          field: 'status',
          value: STATUS_INITIAL
        },{
          op: 'lte',
          field: 'notsendbefore',
          value: Date.now()
        }]
      },
      visiblefields: ['from', 'to', 'subject', 'text', 'html', 'notsendbefore', 'notsendafter'],
      limit: 1,
      singleshot: true
    });
  };

  CommunicationHistorySenderServiceMixin.prototype.readFieldFromCommunicationHistory = function (mailhistoryid, fieldname) {
    return this.readFromCommunicationHistory({
      filter: uniquefilterforid(mailhistoryid),
      visiblefields: [fieldname],
      singleshot: true
    }).then(qlib.resultpropertyreturner(fieldname));
  };

  CommunicationHistorySenderServiceMixin.prototype.writeInitialMessageToCommunicationHistory = function (sender, recipient, subject, body, notbefore, notafter, backreference) {
    return this.writeToCommunicationHistory({
      status: STATUS_INITIAL,
      substatus: 0,
      sendingsystem: null,
      sendingsystemid: null,
      backreference: backreference || null,
      forwardreference: null,
      from: sender,
      to: recipient,
      subject: subject,
      text: body.text,
      html: body.html,
      notsendbefore: notbefore || Date.now(),
      notsendafter: notafter || null,
      sendingsystemnotified: null,
      errors: []
    });
  };

  CommunicationHistorySenderServiceMixin.prototype.writeSendingErrorToCommunicationHistory = function (mailhistoryid, mailercode, error) {
    var errobj = {sendingsystem:mailercode};
    if (error.message) {
      errobj.message = error.message;
    }
    if (error.code) {
      errobj.code = error.code;
    }
    return this.updateCommunicationHistory(mailhistoryid, {errors:errobj}, {op:'addtoset'});
  };

  CommunicationHistorySenderServiceMixin.prototype.updateCommunicationHistoryStatus = function (mailhistoryid, statusnumber) {
    return this.updateCommunicationHistory(mailhistoryid, {status: statusnumber}, {op:'set'});
  };
  CommunicationHistorySenderServiceMixin.prototype.updateCommunicationHistoryStatusAndSubstatus = function (mailhistoryid, statusnumber, substatus) {
    return this.updateCommunicationHistory(mailhistoryid, {status: statusnumber, substatus: substatus}, {op:'set'});
  };

  CommunicationHistorySenderServiceMixin.prototype.markCommunicationHistoryAsError = function (mailhistoryid) {
    return this.updateCommunicationHistoryStatus(mailhistoryid, STATUS_ERROR);
  };

  CommunicationHistorySenderServiceMixin.prototype.markCommunicationHistoryAsCommited = function (mailhistoryid, sendingsystem, sendingsystemid) {
    if (!(lib.isString(sendingsystem) && sendingsystem)) {
      return q.reject(new lib.Error('NO_SENDINGSYSTEM', 'no sendingsystem: '+sendingsystem));
    }
    if (!(lib.isString(sendingsystemid) && sendingsystemid)) {
      return q.reject(new lib.Error('NO_MESSAGEID', 'no sendingsystemid: '+sendingsystemid));
    }
    return this.updateCommunicationHistory(mailhistoryid, {status: STATUS_COMMITED, sendingsystem: sendingsystem, sendingsystemid: sendingsystemid}, {op:'set'});
  };

  CommunicationHistorySenderServiceMixin.prototype.markCommunicationHistoryAsError = function (mailhistoryid) {
    return this.updateCommunicationHistoryStatus(mailhistoryid, STATUS_ERROR);
  };
  CommunicationHistorySenderServiceMixin.prototype.markCommunicationHistoryAsAbandonedDueToExpire = function (mailhistoryid) {
    return this.updateCommunicationHistoryStatusAndSubstatus(mailhistoryid, STATUS_ABANDONED, SUBSTATUS_EXPIRED);
  };
  CommunicationHistorySenderServiceMixin.prototype.markCommunicationHistoryAsAbandonedDueToBlacklist = function (mailhistoryid) {
    return this.updateCommunicationHistoryStatusAndSubstatus(mailhistoryid, STATUS_ABANDONED, SUBSTATUS_BLACKLISTED);
  };

  CommunicationHistorySenderServiceMixin.prototype.getSendingErrorsFromCommunicationHistory = function (mailhistoryid) {
    return this.readFieldFromCommunicationHistory(mailhistoryid, 'errors');
  };
  
  CommunicationHistorySenderServiceMixin.addMethods = function (klass) {
    lib.inheritMethods(klass, CommunicationHistorySenderServiceMixin
      ,'updateCommunicationHistory'
      ,'readFieldFromCommunicationHistory'
      ,'writeInitialMessageToCommunicationHistory'
      ,'writeSendingErrorToCommunicationHistory'
      ,'updateCommunicationHistoryStatus'
      ,'updateCommunicationHistoryStatusAndSubstatus'
      ,'markCommunicationHistoryAsError'
      ,'markCommunicationHistoryAsCommited'
      ,'markCommunicationHistoryAsAbandonedDueToExpire'
      ,'markCommunicationHistoryAsAbandonedDueToBlacklist'
      ,'getSendingErrorsFromCommunicationHistory'
      ,'getMessageToSendFromHistory'
    );
  };

  function uniquefilterforid (id) {
    return {
      op: 'eq',
      field: 'id',
      value: id
    };
  }

  function uniquefilterforsendingsystem (sendingsystemcode, sendingsystemid) {
    return {
      op: 'and',
      filters: [{
        op: 'eq',
        field: 'sendingsystem',
        value: sendingsystemcode
      },{
        op: 'eq',
        field: 'sendingsystemid',
        value: sendingsystemid
      }]
    };
  }

  return CommunicationHistorySenderServiceMixin;
}
module.exports = createServiceMixin;

