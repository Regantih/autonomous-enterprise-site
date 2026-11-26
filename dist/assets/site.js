(function () {
  'use strict';
  document.documentElement.classList.add('js');

  var MESSAGES = {
    valueMissing: function (label) { return label + ' is required.'; },
    typeMismatch: function () { return 'Please enter a valid email address.'; },
    tooShort: function (label, el) { return label + ' must be at least ' + el.minLength + ' characters.'; },
    tooLong: function (label, el) { return label + ' must be ' + el.maxLength + ' characters or fewer.'; },
    badInput: function () { return 'Please enter a valid date.'; }
  };

  function labelFor(form, el) {
    var fs = el.closest('fieldset');
    var lab = fs ? fs.querySelector('legend') : form.querySelector('label[for="' + el.id + '"]');
    var text = lab ? lab.firstChild.textContent : el.name;
    return text.replace(/\s+$/, '');
  }

  function errorSlot(form, name) {
    var el = form.querySelector('[name="' + name + '"]');
    if (!el) return null;
    var field = el.closest('.field');
    return field ? { field: field, input: el, slot: field.querySelector('.field-error') } : null;
  }

  function clearErrors(form) {
    form.querySelectorAll('.field-error').forEach(function (s) { s.textContent = ''; });
    form.querySelectorAll('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
    var status = form.querySelector('.form-status');
    status.textContent = '';
    status.className = 'form-status';
  }

  function showErrors(form, errors) {
    var first = null;
    Object.keys(errors).forEach(function (name) {
      var t = errorSlot(form, name);
      if (!t || !t.slot) return;
      t.slot.textContent = errors[name];
      t.field.querySelectorAll('input, select, textarea').forEach(function (el) { el.setAttribute('aria-invalid', 'true'); });
      if (!first) first = t.input;
    });
    var count = Object.keys(errors).length;
    showStatus(form, count === 1 ? 'Please fix the highlighted field.' : 'Please fix the ' + count + ' highlighted fields.');
    if (first) first.focus();
  }

  function showStatus(form, text) {
    var status = form.querySelector('.form-status');
    status.textContent = text;
    status.className = 'form-status error';
  }

  function clientValidate(form) {
    var errors = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.type === 'hidden' || el.name === 'website' || errors[el.name]) return;
      if (typeof el.value === 'string' && el.type !== 'radio' && el.type !== 'checkbox' && el.value.trim() === '' && el.required) {
        errors[el.name] = MESSAGES.valueMissing(labelFor(form, el));
        return;
      }
      if (el.validity && !el.validity.valid) {
        var v = el.validity;
        var key = v.valueMissing ? 'valueMissing' : v.typeMismatch ? 'typeMismatch' : v.tooShort ? 'tooShort' : v.tooLong ? 'tooLong' : 'badInput';
        errors[el.name] = el.type === 'radio' ? 'Please choose one option.' : MESSAGES[key](labelFor(form, el), el);
      }
    });
    if (form.querySelector('input[name="goals"]') && !form.querySelector('input[name="goals"]:checked')) {
      errors.goals = 'Please choose at least one goal.';
    }
    return errors;
  }

  function collect(form) {
    var data = {};
    new FormData(form).forEach(function (value, key) {
      if (typeof value !== 'string') return;
      if (key === 'goals') (data.goals = data.goals || []).push(value);
      else data[key] = value;
    });
    return data;
  }

  function showSuccess(form) {
    var box = document.createElement('div');
    box.className = 'form-success';
    var h = document.createElement('h3');
    h.tabIndex = -1;
    h.textContent = form.getAttribute('data-success-title') || 'Thank you.';
    var p = document.createElement('p');
    p.textContent = form.getAttribute('data-success-body') || '';
    box.appendChild(h);
    box.appendChild(p);
    box.setAttribute('role', 'status');
    form.replaceWith(box);
    h.focus({ preventScroll: true });
    box.scrollIntoView({ block: 'center' });
  }

  document.querySelectorAll('form.request-form').forEach(function (form) {
    form.noValidate = true;
    var button = form.querySelector('button[type="submit"]');
    var idle = button.textContent;

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (button.disabled) return;
      clearErrors(form);
      var errors = clientValidate(form);
      if (Object.keys(errors).length) { showErrors(form, errors); return; }

      button.disabled = true;
      button.textContent = 'Sending\u2026';
      form.setAttribute('aria-busy', 'true');

      fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(collect(form)),
        credentials: 'same-origin'
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (body) { return { res: res, body: body }; });
        })
        .then(function (r) {
          if (r.res.ok && r.body.ok) { showSuccess(form); return; }
          if (r.body.errors) { showErrors(form, r.body.errors); return; }
          showStatus(form, r.body.error || 'Something went wrong. Please try again later.');
          form.querySelector('.form-status').focus();
        })
        .catch(function () {
          showStatus(form, 'We could not send your request. Check your connection and try again.');
          form.querySelector('.form-status').focus();
        })
        .then(function () {
          if (!form.isConnected) return;
          button.disabled = false;
          button.textContent = idle;
          form.removeAttribute('aria-busy');
        });
    });
  });
})();
