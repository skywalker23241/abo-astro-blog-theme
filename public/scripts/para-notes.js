;(function () {
  if (window.__paraNotesController) {
    window.__paraNotesController.schedule()
    return
  }

  var initPending = false
  var cleanupCurrentPage = function () {}
  var storageKey = 'para-notes-admin-passcode'

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')
  }

  function formatDate(value) {
    var date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  function getElements() {
    return {
      page: document.querySelector('.para-notes-page'),
      editToggle: document.querySelector('#memo-edit-toggle'),
      searchToggle: document.querySelector('#memo-search-toggle'),
      editor: document.querySelector('#memo-editor'),
      form: document.querySelector('#memo-form'),
      formTitle: document.querySelector('#memo-form-title'),
      memoId: document.querySelector('#memo-id'),
      title: document.querySelector('#memo-title'),
      content: document.querySelector('#memo-content'),
      submit: document.querySelector('#memo-submit'),
      cancelEdit: document.querySelector('#memo-cancel-edit'),
      list: document.querySelector('#memo-list'),
      empty: document.querySelector('#memo-empty'),
      searchModal: document.querySelector('#memo-search-modal'),
      searchInput: document.querySelector('#memo-search-input'),
      passcodeModal: document.querySelector('#memo-passcode-modal'),
      passcodeForm: document.querySelector('#memo-passcode-form'),
      passcodeInput: document.querySelector('#memo-passcode-input')
    }
  }

  function initParaNotes() {
    var elements = getElements()
    if (!elements.page || elements.page.dataset.paraNotesInit === '1') return
    elements.page.dataset.paraNotesInit = '1'

    var state = {
      notes: [],
      filteredNotes: [],
      authenticated: false,
      editingId: '',
      busy: false,
      loaded: false,
      keyword: ''
    }
    var passcodeTimer = 0
    var unlockAttemptId = 0

    function setStatus(message, type) {
      if (type === 'error' && elements.empty && state.filteredNotes.length === 0) {
        elements.empty.textContent = message
      }
    }

    function setBusy(busy) {
      state.busy = busy
      ;[
        elements.editToggle,
        elements.searchToggle,
        elements.title,
        elements.content,
        elements.submit,
        elements.cancelEdit,
        elements.passcodeInput,
        elements.searchInput
      ].forEach(function (control) {
        if (
          control instanceof HTMLButtonElement ||
          control instanceof HTMLInputElement ||
          control instanceof HTMLTextAreaElement
        ) {
          control.disabled = busy
        }
      })
    }

    function showModal(kind) {
      var modal = kind === 'search' ? elements.searchModal : elements.passcodeModal
      if (!modal) return
      modal.removeAttribute('hidden')

      window.setTimeout(function () {
        if (kind === 'search' && elements.searchInput instanceof HTMLInputElement) {
          elements.searchInput.focus()
        }

        if (kind === 'passcode' && elements.passcodeInput instanceof HTMLInputElement) {
          elements.passcodeInput.focus()
        }
      }, 0)
    }

    function hideModal(kind) {
      var modal = kind === 'search' ? elements.searchModal : elements.passcodeModal
      if (kind === 'passcode') window.clearTimeout(passcodeTimer)
      if (modal) modal.setAttribute('hidden', '')
    }

    function getPasscode() {
      return elements.passcodeInput instanceof HTMLInputElement
        ? elements.passcodeInput.value.trim()
        : ''
    }

    async function unlockWithPasscode(passcode) {
      var normalizedPasscode = passcode.trim()
      if (!normalizedPasscode || state.authenticated) return

      var attemptId = ++unlockAttemptId

      try {
        if (elements.passcodeInput instanceof HTMLInputElement) {
          elements.passcodeInput.setAttribute('aria-busy', 'true')
        }

        var response = await fetch('/api/para-notes', {
          method: 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            passcode: normalizedPasscode,
            title: 'auth-check',
            content: 'auth-check',
            dryRun: true
          })
        })

        var data = await response.json().catch(function () {
          return {}
        })
        if (attemptId !== unlockAttemptId) return

        if (!response.ok) {
          if (response.status === 401) return
          throw new Error(typeof data.error === 'string' ? data.error : 'invalid admin passcode')
        }

        if (getPasscode() !== normalizedPasscode) return

        sessionStorage.setItem(storageKey, normalizedPasscode)
        setAuthenticated(true)
        hideModal('passcode')
      } catch (error) {
        if (attemptId !== unlockAttemptId) return
        setStatus(error instanceof Error ? error.message : 'Admin verification failed', 'error')
      } finally {
        if (attemptId === unlockAttemptId && elements.passcodeInput instanceof HTMLInputElement) {
          elements.passcodeInput.removeAttribute('aria-busy')
        }
      }
    }

    function resetForm() {
      state.editingId = ''
      if (elements.formTitle) elements.formTitle.textContent = 'New memo'
      if (elements.memoId instanceof HTMLInputElement) elements.memoId.value = ''
      if (elements.title instanceof HTMLInputElement) elements.title.value = ''
      if (elements.content instanceof HTMLTextAreaElement) elements.content.value = ''
      if (elements.submit instanceof HTMLButtonElement) elements.submit.textContent = 'Save'
      if (elements.cancelEdit instanceof HTMLButtonElement) elements.cancelEdit.hidden = true
    }

    function beginEdit(note) {
      state.editingId = note.id
      if (elements.formTitle) elements.formTitle.textContent = 'Edit memo'
      if (elements.memoId instanceof HTMLInputElement) elements.memoId.value = note.id
      if (elements.title instanceof HTMLInputElement) elements.title.value = note.title
      if (elements.content instanceof HTMLTextAreaElement) elements.content.value = note.content
      if (elements.submit instanceof HTMLButtonElement) elements.submit.textContent = 'Update'
      if (elements.cancelEdit instanceof HTMLButtonElement) elements.cancelEdit.hidden = false
      if (elements.editor) elements.editor.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    function applySearch() {
      var keyword = state.keyword.trim().toLowerCase()
      state.filteredNotes = state.notes.filter(function (note) {
        if (!keyword) return true
        return (note.title + '\n' + note.content).toLowerCase().includes(keyword)
      })
      renderNotes()
    }

    function setAuthenticated(nextValue) {
      state.authenticated = nextValue
      if (elements.editor) elements.editor.toggleAttribute('hidden', !nextValue)

      if (elements.editToggle instanceof HTMLButtonElement) {
        elements.editToggle.setAttribute('aria-label', nextValue ? 'Lock editing' : 'Edit memos')
        elements.editToggle.classList.toggle('is-active', nextValue)
      }

      if (!nextValue) {
        sessionStorage.removeItem(storageKey)
        if (elements.passcodeInput instanceof HTMLInputElement) elements.passcodeInput.value = ''
        hideModal('passcode')
        resetForm()
      }

      renderNotes()
    }

    function renderNotes() {
      if (!elements.list || !elements.empty) return

      elements.empty.hidden = state.filteredNotes.length !== 0
      if (state.filteredNotes.length === 0) {
        elements.empty.textContent = state.keyword
          ? 'No matching memos.'
          : state.loaded
            ? 'No memos yet.'
            : 'Loading...'
      }

      elements.list.innerHTML = state.filteredNotes
        .map(function (note) {
          var actions = state.authenticated
            ? '<div class="memo-actions">' +
              '<button class="ghost-text-button" type="button" data-action="edit" data-id="' +
              escapeHtml(note.id) +
              '">Edit</button>' +
              '<button class="ghost-text-button danger-button" type="button" data-action="delete" data-id="' +
              escapeHtml(note.id) +
              '">Delete</button>' +
              '</div>'
            : ''

          return (
            '<article class="memo-card">' +
            '<div class="memo-card-head"><div>' +
            '<h2 class="memo-title">' +
            escapeHtml(note.title) +
            '</h2>' +
            '<p class="memo-time">' +
            escapeHtml(formatDate(note.updatedAt)) +
            '</p>' +
            '</div>' +
            actions +
            '</div>' +
            '<p class="memo-content">' +
            escapeHtml(note.content).replaceAll('\n', '<br />') +
            '</p>' +
            '</article>'
          )
        })
        .join('')
    }

    async function loadNotes() {
      try {
        var response = await fetch('/api/para-notes')
        var data = await response.json()
        state.notes = Array.isArray(data.notes) ? data.notes : []
      } catch {
        setStatus('Failed to load memos. Please try again later.', 'error')
      } finally {
        state.loaded = true
        applySearch()
      }
    }

    async function request(method, payload) {
      setBusy(true)

      try {
        var response = await fetch('/api/para-notes', {
          method,
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify(payload)
        })

        var data = await response.json().catch(function () {
          return {}
        })
        if (!response.ok) {
          throw new Error(typeof data.error === 'string' ? data.error : 'request failed')
        }

        state.notes = Array.isArray(data.notes) ? data.notes : state.notes
        applySearch()
        return data
      } finally {
        setBusy(false)
      }
    }

    var onSearchToggleClick = function () {
      showModal('search')
    }

    var onEditToggleClick = function () {
      if (state.authenticated) {
        setAuthenticated(false)
        setStatus('Exited edit mode.')
        return
      }

      showModal('passcode')
    }

    var onSearchInput = function () {
      if (!(elements.searchInput instanceof HTMLInputElement)) return
      state.keyword = elements.searchInput.value
      applySearch()
    }

    var onPasscodeSubmit = function (event) {
      event.preventDefault()
    }

    var onPasscodeInput = function () {
      window.clearTimeout(passcodeTimer)
      if (!getPasscode()) return
      passcodeTimer = window.setTimeout(function () {
        unlockWithPasscode(getPasscode())
      }, 320)
    }

    var onFormSubmit = async function (event) {
      event.preventDefault()

      var passcode = getPasscode() || sessionStorage.getItem(storageKey) || ''
      var title = elements.title instanceof HTMLInputElement ? elements.title.value.trim() : ''
      var content =
        elements.content instanceof HTMLTextAreaElement ? elements.content.value.trim() : ''

      if (!passcode) {
        setStatus('Missing admin passcode.', 'error')
        return
      }

      if (!title || !content) {
        setStatus('Title and content cannot be empty.', 'error')
        return
      }

      try {
        if (state.editingId) {
          await request('PUT', {
            id: state.editingId,
            title: title,
            content: content,
            passcode: passcode
          })
          setStatus('Memo updated.')
        } else {
          await request('POST', { title: title, content: content, passcode: passcode })
          setStatus('Memo saved.')
        }

        resetForm()
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Failed to save', 'error')
      }
    }

    var onCancelEditClick = function () {
      resetForm()
      setStatus('Edit cancelled.')
    }

    var onListClick = async function (event) {
      var target = event.target
      if (!(target instanceof HTMLElement)) return

      var action = target.dataset.action
      var id = target.dataset.id
      if (!action || !id) return

      var note = state.notes.find(function (item) {
        return item.id === id
      })
      if (!note) return

      if (action === 'edit') {
        beginEdit(note)
        return
      }

      if (action === 'delete') {
        var passcode = getPasscode() || sessionStorage.getItem(storageKey) || ''
        if (!passcode) {
          setStatus('Missing admin passcode.', 'error')
          return
        }

        if (!window.confirm('Delete memo "' + note.title + '"?')) return

        try {
          await request('DELETE', { id: id, passcode: passcode })
          if (state.editingId === id) resetForm()
          setStatus('Memo deleted.')
        } catch (error) {
          setStatus(error instanceof Error ? error.message : 'Failed to delete', 'error')
        }
      }
    }

    var onDocumentClick = function (event) {
      var target = event.target
      if (!(target instanceof HTMLElement)) return

      var kind = target.dataset.closeModal
      if (kind === 'search' || kind === 'passcode') hideModal(kind)
    }

    var onDocumentKeydown = function (event) {
      if (event.key !== 'Escape') return
      hideModal('search')
      hideModal('passcode')
    }

    if (elements.searchToggle) elements.searchToggle.addEventListener('click', onSearchToggleClick)
    if (elements.editToggle) elements.editToggle.addEventListener('click', onEditToggleClick)
    if (elements.searchInput) elements.searchInput.addEventListener('input', onSearchInput)
    if (elements.passcodeForm) elements.passcodeForm.addEventListener('submit', onPasscodeSubmit)
    if (elements.passcodeInput) elements.passcodeInput.addEventListener('input', onPasscodeInput)
    if (elements.form) elements.form.addEventListener('submit', onFormSubmit)
    if (elements.cancelEdit) elements.cancelEdit.addEventListener('click', onCancelEditClick)
    if (elements.list) elements.list.addEventListener('click', onListClick)
    document.addEventListener('click', onDocumentClick)
    document.addEventListener('keydown', onDocumentKeydown)

    var rememberedPasscode = sessionStorage.getItem(storageKey)
    if (rememberedPasscode && elements.passcodeInput instanceof HTMLInputElement) {
      elements.passcodeInput.value = rememberedPasscode
      setAuthenticated(true)
      setStatus('Edit mode restored.')
    } else {
      setAuthenticated(false)
    }

    loadNotes()

    cleanupCurrentPage = function () {
      window.clearTimeout(passcodeTimer)
      unlockAttemptId += 1
      if (elements.searchToggle)
        elements.searchToggle.removeEventListener('click', onSearchToggleClick)
      if (elements.editToggle) elements.editToggle.removeEventListener('click', onEditToggleClick)
      if (elements.searchInput) elements.searchInput.removeEventListener('input', onSearchInput)
      if (elements.passcodeForm)
        elements.passcodeForm.removeEventListener('submit', onPasscodeSubmit)
      if (elements.passcodeInput)
        elements.passcodeInput.removeEventListener('input', onPasscodeInput)
      if (elements.form) elements.form.removeEventListener('submit', onFormSubmit)
      if (elements.cancelEdit) elements.cancelEdit.removeEventListener('click', onCancelEditClick)
      if (elements.list) elements.list.removeEventListener('click', onListClick)
      document.removeEventListener('click', onDocumentClick)
      document.removeEventListener('keydown', onDocumentKeydown)
      elements.page.dataset.paraNotesInit = '0'
    }
  }

  function schedule() {
    if (initPending) return
    initPending = true
    requestAnimationFrame(function () {
      initPending = false
      initParaNotes()
    })
  }

  function cleanup() {
    cleanupCurrentPage()
    cleanupCurrentPage = function () {}
  }

  window.__paraNotesController = {
    schedule: schedule,
    cleanup: cleanup
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule, { once: true })
  } else {
    schedule()
  }
  document.addEventListener('astro:after-swap', schedule)
  document.addEventListener('astro:page-load', schedule)
  document.addEventListener('astro:before-swap', cleanup)
})()
