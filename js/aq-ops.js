/* AQHub shared Sync + Bot Runner helpers. No secrets. Never auto-send. */
(function (root) {
  function parseBody(text) {
    if (text == null) return null;
    var s = String(text).trim();
    if (!s) return null;
    try { return JSON.parse(s); } catch (e) { return null; }
  }

  function apiErrorText(status, bodyText) {
    var j = parseBody(bodyText);
    if (j && typeof j === 'object') {
      var msg = j.message || j.error || '';
      if (msg) return String(msg);
      try { return JSON.stringify(j); } catch (e2) {}
    }
    var t = String(bodyText || '').trim();
    if (t) return t;
    return 'HTTP ' + (status || '?');
  }

  function isFailurePayload(j) {
    if (!j || typeof j !== 'object') return false;
    if (j.ok === false) return true;
    if (j.error && !j.id && !j.status && !j.jobs) return true;
    return false;
  }

  async function fetchJson(path, opts) {
    var fetchFn = (root && typeof root.fetch === 'function') ? root.fetch : (typeof fetch === 'function' ? fetch : null);
    if (!fetchFn) throw new Error('fetch_unavailable');
    var r;
    try {
      r = await fetchFn(path, opts);
    } catch (e) {
      throw new Error((e && e.message) ? e.message : 'network_error');
    }
    var text = await r.text();
    var json = parseBody(text);
    if (!r.ok || isFailurePayload(json)) {
      throw new Error(apiErrorText(r.status, text));
    }
    if (json == null) {
      if (!r.ok) throw new Error(apiErrorText(r.status, text));
      return text;
    }
    return json;
  }

  function formatSyncResult(j) {
    if (!j || typeof j !== 'object') return 'مزامنة تمّت';
    var parts = [];
    if (j.added != null) parts.push(String(j.added) + ' جديد');
    if (j.scanned != null) parts.push('فحص ' + String(j.scanned));
    if (j.unreadTotal != null) parts.push('غير مقروء ' + String(j.unreadTotal));
    if (!parts.length) parts.push('مزامنة تمّت');
    return parts.join(' · ');
  }

  function isJobRunning(job) {
    var st = job && job.status;
    return st === 'queued' || st === 'running';
  }

  function formatJobUserText(job) {
    if (!job) return '—';
    var st = job.status || '';
    if (st === 'queued') return 'في الانتظار';
    if (st === 'running') return 'شغال…';
    if (st === 'stopped') return 'اتوقف';
    if (st === 'error') {
      var err = (job.result && (job.result.message || job.result.error)) || job.error || 'error';
      return 'فشل: ' + String(err);
    }
    if (st === 'done') {
      var action = String(job.action || (job.result && job.result.kind) || '');
      var hasDraft = !!(job.result && job.result.suggestedReply);
      if (/draft|prepare_reply|jehez/i.test(action) || hasDraft) {
        return 'المسودة جاهزة للمراجعة — ما اتبعتش إيميل';
      }
      return 'الأمر خلص';
    }
    return st || '—';
  }

  function jobLogText(job) {
    var lines = (job && job.log) || [];
    return lines.map(function (ln) {
      var msg = (ln && (ln.msg || ln.message)) || String(ln);
      var t = ln && ln.t ? String(ln.t) : '';
      return (t ? t + '  ' : '') + msg;
    }).join('\n');
  }

  function neverSendHint() {
    return 'مسودة للمراجعة — ما بيتبعتش إيميل تلقائي';
  }

  function claimsSend(text) {
    var s = String(text || '');
    return /اتبعت الإيميل|تم الإرسال|mail sent|email sent/i.test(s);
  }

  function el(id) { return document.getElementById(id); }

  function setKind(node, kind, text) {
    if (!node) return;
    var base = node.dataset.baseClass || node.className.replace(/\b(ok|err|wait)\b/g, '').trim();
    node.dataset.baseClass = base;
    node.className = base + (kind ? (' ' + kind) : '');
    if (text != null) node.textContent = text;
  }

  function bindControlPanel() {
    var state = { tasks: [], activeJobId: null, pollTimer: null };
    function toast(msg) {
      var node = el('toast');
      if (!node) return;
      node.textContent = msg;
      node.classList.add('show');
      clearTimeout(window.__aqOpsToast);
      window.__aqOpsToast = setTimeout(function () { node.classList.remove('show'); }, 7000);
    }
    function setSync(kind, text) { setKind(el('syncStatus'), kind, text); }
    function setJob(kind, text) { setKind(el('jobStatus'), kind, text); }
    function showLog(job) {
      var node = el('opsLog');
      if (!node) return;
      var txt = jobLogText(job);
      if (txt) { node.hidden = false; node.textContent = txt; }
    }
    function stopPoll() {
      if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
    }
    function fillTasks() {
      var sel = el('opsTask');
      if (!sel) return;
      var prev = sel.value;
      var open = state.tasks.filter(function (t) {
        var st = String(t.status || '').toLowerCase();
        return st !== 'done' && st !== 'closed';
      });
      if (!open.length) open = state.tasks.slice();
      sel.innerHTML = open.map(function (t) {
        return '<option value="' + String(t.id).replace(/"/g, '') + '">' +
          String(t.id) + ' · ' + String(t.title || '').replace(/</g, '') + '</option>';
      }).join('') || '<option value="">مفيش تاسكات</option>';
      if (prev && open.some(function (t) { return t.id === prev; })) sel.value = prev;
      paintRoom();
    }
    function currentTaskId() {
      var sel = el('opsTask');
      return sel && sel.value ? sel.value : '';
    }
    function paintRoom() {
      var room = el('opsRoom');
      var id = currentTaskId();
      if (!room) return;
      if (id) { room.hidden = false; room.href = './task.html?id=' + encodeURIComponent(id); }
      else room.hidden = true;
    }
    async function loadTasks() {
      try {
        var j = await fetchJson('/api/tasks');
        state.tasks = Array.isArray(j) ? j : (j.tasks || []);
        fillTasks();
      } catch (e) {
        toast('فشل تحميل التاسكات: ' + (e.message || e));
      }
    }
    async function syncMail() {
      var btn = el('btnSync');
      if (btn) btn.disabled = true;
      setSync('wait', 'بقرأ الوارد غير المقروء…');
      toast('مزامنة الإيميل… وارد غير المقروء — من غير إرسال');
      try {
        var j = await fetchJson('/api/mail/sync', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
        });
        var detail = formatSyncResult(j);
        setSync('ok', detail);
        toast('مزامنة تمّت — ' + detail);
        await loadTasks();
      } catch (e) {
        var msg = e.message || String(e);
        setSync('err', msg);
        toast('فشل المزامنة: ' + msg);
      } finally {
        if (btn) btn.disabled = false;
      }
    }
    async function patchAction(taskId, action) {
      var data = await fetchJson('/api/tasks');
      var payload = Array.isArray(data) ? { tasks: data, updatedAt: new Date().toISOString() } : data;
      if (!Array.isArray(payload.tasks)) payload.tasks = [];
      var t = payload.tasks.find(function (x) { return x.id === taskId; });
      if (!t) throw new Error('task_not_found');
      t.botAction = action;
      t.updatedAt = new Date().toISOString();
      payload.updatedAt = t.updatedAt;
      await fetchJson('/api/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      state.tasks = payload.tasks;
    }
    async function pollJob() {
      if (!state.activeJobId) return;
      try {
        var job = await fetchJson('/api/bot/job?id=' + encodeURIComponent(state.activeJobId));
        var running = isJobRunning(job);
        if (el('btnStopBot')) el('btnStopBot').disabled = !running;
        setJob(running ? 'wait' : (job.status === 'error' ? 'err' : 'ok'), formatJobUserText(job));
        showLog(job);
        if (!running) {
          stopPoll();
          toast(formatJobUserText(job));
          await loadTasks();
        }
      } catch (e) {
        setJob('err', e.message || String(e));
        toast('فشل قراءة الأمر: ' + (e.message || e));
      }
    }
    async function runBot() {
      var taskId = currentTaskId();
      if (!taskId) { setJob('err', 'اختار تاسك'); toast('اختار تاسك'); return; }
      var action = (el('opsAction') && el('opsAction').value) || 'draft_reply';
      var mode = (el('opsMode') && el('opsMode').value) || 'live';
      try {
        setJob('wait', 'بجهّز الأمر…');
        await patchAction(taskId, action);
        var j = await fetchJson('/api/bot/run', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId: taskId, mode: mode })
        });
        if (!j || !j.id) throw new Error((j && (j.message || j.error)) || 'no_job_id');
        state.activeJobId = j.id;
        if (el('btnStopBot')) el('btnStopBot').disabled = false;
        setJob('wait', 'شغال… ' + taskId + ' · ' + action);
        toast('تشغيل البوت — مسودة من غير إرسال');
        stopPoll();
        pollJob();
        state.pollTimer = setInterval(pollJob, 500);
      } catch (e) {
        setJob('err', e.message || String(e));
        toast('فشل التشغيل: ' + (e.message || e));
      }
    }
    async function stopBot() {
      if (!state.activeJobId) {
        try {
          var list = await fetchJson('/api/bot/jobs');
          var jobs = (list && list.jobs) || [];
          var running = jobs.find(function (j) { return isJobRunning(j); });
          if (running) state.activeJobId = running.id;
        } catch (e2) {}
      }
      if (!state.activeJobId) { setJob('err', 'مفيش أمر شغال'); toast('مفيش أمر شغال'); return; }
      try {
        if (el('btnStopBot')) el('btnStopBot').disabled = true;
        await fetchJson('/api/bot/stop', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: state.activeJobId })
        });
        await pollJob();
      } catch (e) {
        setJob('err', e.message || String(e));
        toast('فشل الإيقاف: ' + (e.message || e));
        if (el('btnStopBot')) el('btnStopBot').disabled = false;
      }
    }
    if (el('btnSync')) el('btnSync').addEventListener('click', function () { syncMail(); });
    if (el('btnRunBot')) el('btnRunBot').addEventListener('click', function () { runBot(); });
    if (el('btnStopBot')) el('btnStopBot').addEventListener('click', function () { stopBot(); });
    if (el('opsTask')) el('opsTask').addEventListener('change', paintRoom);
    loadTasks();
    return { syncMail: syncMail, runBot: runBot, stopBot: stopBot, loadTasks: loadTasks };
  }

  root.AQOps = {
    parseBody: parseBody,
    apiErrorText: apiErrorText,
    isFailurePayload: isFailurePayload,
    fetchJson: fetchJson,
    formatSyncResult: formatSyncResult,
    isJobRunning: isJobRunning,
    formatJobUserText: formatJobUserText,
    jobLogText: jobLogText,
    neverSendHint: neverSendHint,
    claimsSend: claimsSend,
    bindControlPanel: bindControlPanel
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
