import { showToast, hideToast, placeToast } from './site-toast'
import MarkdownIt from 'markdown-it'
import { closeWithMotion } from './close-with-motion'
import { paraCategories, normalizeParaCategory } from '../data/para-categories'

const markdown = new MarkdownIt({ html: false, breaks: true })
// Keep remote images on demand by rendering them as links.
markdown.renderer.rules.image = function (tokens, index) {
  const token = tokens[index]
  return (
    '<a href="' +
    markdown.utils.escapeHtml(token.attrGet('src') || '') +
    '">' +
    markdown.utils.escapeHtml(token.content || '图片') +
    '</a>'
  )
}
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
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  function getMemoAnchorId(note, index) {
    var normalizedId = String(note.id)
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    return 'memo-' + (normalizedId || String(index + 1))
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
      category: document.querySelector('#memo-category'),
      categories: document.querySelector('.para-categories'),
      showAll: document.querySelector('#memo-show-all'),
      folderHeading: document.querySelector('#memo-folder-heading'),
      folderTitle: document.querySelector('#memo-folder-title'),
      stream: document.querySelector('#memo-stream'),
      content: document.querySelector('#memo-content'),
      preview: document.querySelector('#memo-preview'),
      workspace: document.querySelector('#memo-workspace'),
      counter: document.querySelector('#memo-counter'),
      submit: document.querySelector('#memo-submit'),
      cancelEdit: document.querySelector('#memo-cancel-edit'),
      list: document.querySelector('#memo-list'),
      empty: document.querySelector('#memo-empty'),
      railList: document.querySelector('#memo-rail-list'),
      railEmpty: document.querySelector('#memo-rail-empty'),
      searchModal: document.querySelector('#memo-search-modal'),
      searchInput: document.querySelector('#memo-search-input'),
      searchCount: document.querySelector('#memo-search-count'),
      readerModal: document.querySelector('#memo-reader-modal'),
      readerTitle: document.querySelector('#memo-reader-title'),
      readerTime: document.querySelector('#memo-reader-time'),
      readerContent: document.querySelector('#memo-reader-content'),
      passcodeModal: document.querySelector('#memo-passcode-modal'),
      passcodeForm: document.querySelector('#memo-passcode-form'),
      passcodeInput: document.querySelector('#memo-passcode-input'),
      unlock: document.querySelector('#memo-unlock')
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
      revision: '',
      editingRevision: '',
      busy: false,
      loaded: false,
      loadFailed: false,
      keyword: '',
      category: ''
    }
    var unlockAttemptId = 0
    var unlocking = false
    var modalFocus = null
    var previousOverflow = ''
    var modalScroll = { x: 0, y: 0 }
    var activeModal = ''
    var originalDraft = ''
    var editorMode = 'split'
    var dataGeneration = 0

    function draftValue() {
      return JSON.stringify([elements.title.value, elements.content.value, elements.category.value])
    }

    function discardDraft() {
      return draftValue() === originalDraft || window.confirm('有尚未保存的修改，确定放弃吗？')
    }

    function updatePreview() {
      elements.preview.innerHTML = markdown.render(elements.content.value)
      elements.counter.textContent = elements.content.value.length + ' / 4000'
    }

    function setEditorMode(mode) {
      editorMode = mode
      elements.workspace.dataset.mode = mode
      elements.content.hidden = mode === 'preview'
      elements.preview.hidden = mode === 'write'
      elements.form.querySelectorAll('[data-mode]').forEach(function (button) {
        button.setAttribute('aria-pressed', String(button.dataset.mode === mode))
      })
      elements.form.querySelectorAll('[data-format]').forEach(function (button) {
        button.disabled = state.busy || mode === 'preview'
      })
    }

    function insertFormat(format) {
      var input = elements.content
      var start = input.selectionStart
      var end = input.selectionEnd
      var selected = input.value.slice(start, end)
      var formats = {
        bold: ['**', '**', '加粗文字'],
        italic: ['*', '*', '斜体文字'],
        heading: ['## ', '', '标题'],
        quote: ['> ', '', '引用'],
        list: ['- ', '', '列表项'],
        code: ['`', '`', '代码'],
        link: ['[', '](https://example.com)', '链接文字']
      }
      var parts = formats[format]
      if (!parts) return
      var prefix = parts[0]
      if (
        ['heading', 'quote', 'list'].includes(format) &&
        start > 0 &&
        input.value[start - 1] !== '\n'
      )
        prefix = '\n' + prefix
      var text = selected || parts[2]
      var replacement = prefix + text + parts[1]
      if (input.value.length - (end - start) + replacement.length > input.maxLength) {
        setStatus('内容已达到 4000 字符上限。', 'error')
        return
      }
      input.focus()
      input.setRangeText(replacement, start, end, 'end')
      input.setSelectionRange(start + prefix.length, start + prefix.length + text.length)
      updatePreview()
    }

    function setStatus(message, type) {
      showToast(message, type === 'error' ? 'error' : 'success')
    }

    function setBusy(busy) {
      state.busy = busy
      elements.form
        .querySelectorAll('[data-format], [data-mode], [data-editor-category]')
        .forEach(function (button) {
          button.disabled = busy || (button.hasAttribute('data-format') && editorMode === 'preview')
        })
      ;[
        elements.editToggle,
        elements.searchToggle,
        elements.title,
        elements.category,
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
      var modal = elements[kind + 'Modal']
      if (!modal) return
      if (modal.open) return
      if (activeModal) hideModal(activeModal, true)
      modalFocus = document.activeElement
      previousOverflow = document.documentElement.style.overflow
      modalScroll = { x: window.scrollX, y: window.scrollY }
      document.documentElement.style.overflow = 'hidden'
      modal.showModal()
      activeModal = kind
      placeToast()

      window.setTimeout(function () {
        if (kind === 'search' && elements.searchInput instanceof HTMLInputElement) {
          elements.searchInput.focus()
        }

        if (kind === 'passcode' && elements.passcodeInput instanceof HTMLInputElement) {
          elements.passcodeInput.focus()
        }
      }, 0)
    }

    function hideModal(kind, immediate = false) {
      var modal = elements[kind + 'Modal']
      if (!modal || !modal.open) return
      if (kind === 'passcode') {
        unlockAttemptId += 1
        unlocking = false
        elements.unlock.disabled = false
        elements.unlock.textContent = '解锁编辑'
        elements.passcodeInput.removeAttribute('aria-busy')
      }
      closeWithMotion(
        modal,
        function () {
          modal.close()
          activeModal = ''
          placeToast()
          document.documentElement.style.overflow = previousOverflow
          window.scrollTo({ left: modalScroll.x, top: modalScroll.y, behavior: 'instant' })
          if (modalFocus instanceof HTMLElement) modalFocus.focus({ preventScroll: true })
          if (kind === 'reader') elements.readerContent.replaceChildren()
        },
        immediate
      )
    }

    function getPasscode() {
      return elements.passcodeInput instanceof HTMLInputElement
        ? elements.passcodeInput.value.trim()
        : ''
    }

    async function unlockWithPasscode(passcode) {
      var normalizedPasscode = passcode.trim()
      if (!normalizedPasscode || state.authenticated || unlocking) return

      var attemptId = ++unlockAttemptId
      unlocking = true
      elements.unlock.disabled = true
      elements.unlock.textContent = '正在验证…'

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

        if (attemptId !== unlockAttemptId) return

        if (!response.ok) {
          throw new Error('authentication failed')
        }

        if (getPasscode() !== normalizedPasscode) return

        sessionStorage.setItem(storageKey, normalizedPasscode)
        setAuthenticated(true)
        hideModal('passcode')
        setStatus('已进入编辑模式。')
      } catch {
        if (attemptId !== unlockAttemptId) return
        setStatus('验证失败，请检查口令后重试。', 'error')
      } finally {
        if (attemptId === unlockAttemptId && elements.passcodeInput instanceof HTMLInputElement) {
          unlocking = false
          elements.unlock.disabled = false
          elements.unlock.textContent = '解锁编辑'
          elements.passcodeInput.removeAttribute('aria-busy')
        }
      }
    }

    function setEditorCategory(category) {
      elements.category.value = normalizeParaCategory(category)
      elements.form.querySelectorAll('[data-editor-category]').forEach(function (button) {
        button.setAttribute(
          'aria-pressed',
          String(button.dataset.editorCategory === elements.category.value)
        )
      })
    }

    function resetForm() {
      state.editingId = ''
      state.editingRevision = ''
      if (elements.formTitle) elements.formTitle.textContent = '新增笔记'
      if (elements.memoId instanceof HTMLInputElement) elements.memoId.value = ''
      if (elements.title instanceof HTMLInputElement) elements.title.value = ''
      if (elements.content instanceof HTMLTextAreaElement) elements.content.value = ''
      setEditorCategory(state.category)
      if (elements.submit instanceof HTMLButtonElement) elements.submit.textContent = '保存笔记'
      originalDraft = draftValue()
      updatePreview()
    }

    function beginEdit(note) {
      if (!discardDraft()) return
      state.editingId = note.id
      state.editingRevision = state.revision
      if (elements.formTitle) elements.formTitle.textContent = '编辑笔记'
      if (elements.memoId instanceof HTMLInputElement) elements.memoId.value = note.id
      if (elements.title instanceof HTMLInputElement) elements.title.value = note.title
      if (elements.content instanceof HTMLTextAreaElement) elements.content.value = note.content
      setEditorCategory(note.category)
      if (elements.submit instanceof HTMLButtonElement) elements.submit.textContent = '保存修改'
      if (elements.cancelEdit instanceof HTMLButtonElement) elements.cancelEdit.hidden = false
      originalDraft = draftValue()
      updatePreview()
      setEditorMode('split')
      if (elements.editor) elements.editor.scrollIntoView({ block: 'start' })
      elements.content.focus({ preventScroll: true })
    }

    function applySearch() {
      var keyword = state.keyword.trim().toLowerCase()
      state.filteredNotes = state.notes.filter(function (note) {
        if (state.category && normalizeParaCategory(note.category) !== state.category) return false
        if (!keyword) return true
        return (note.title + '\n' + note.content).toLowerCase().includes(keyword)
      })
      var category = paraCategories.find(function (item) {
        return item.id === state.category
      })
      elements.folderTitle.textContent = category ? category.name : '搜索结果'
      elements.categories.querySelectorAll('[data-category-count]').forEach(function (count) {
        count.textContent = state.loaded
          ? String(
              state.notes.filter(function (note) {
                return normalizeParaCategory(note.category) === count.dataset.categoryCount
              }).length
            )
          : '—'
      })
      elements.searchCount.textContent =
        (category ? category.name : '全部笔记') + '：找到 ' + state.filteredNotes.length + ' 篇笔记'
      renderNotes()
    }

    function setAuthenticated(nextValue) {
      state.authenticated = nextValue
      if (elements.editor) elements.editor.toggleAttribute('hidden', !nextValue)

      if (elements.editToggle instanceof HTMLButtonElement) {
        elements.editToggle.setAttribute('aria-label', nextValue ? '退出编辑模式' : '编辑笔记')
        elements.editToggle.setAttribute('title', nextValue ? '退出编辑模式' : '编辑笔记')
        elements.editToggle.querySelector('[data-memo-edit-icon]').hidden = nextValue
        elements.editToggle.querySelector('[data-memo-exit-icon]').hidden = !nextValue
        elements.editToggle.classList.toggle('is-active', nextValue)
        var editLabel = elements.editToggle.querySelector('.memo-edit-label')
        if (editLabel) editLabel.textContent = nextValue ? '退出编辑' : '编辑笔记'
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

      var folderOverview = !state.category && !state.keyword.trim()
      elements.categories.hidden = !folderOverview
      elements.folderHeading.hidden = folderOverview
      elements.stream.hidden = folderOverview && !state.loadFailed
      elements.empty.hidden = state.filteredNotes.length !== 0
      if (state.filteredNotes.length === 0) {
        elements.empty.textContent = state.loadFailed
          ? '加载笔记失败，请刷新重试。'
          : !state.loaded
            ? '正在加载笔记…'
            : state.keyword
              ? '当前分类下没有匹配的笔记，可调整关键词或查看全部笔记。'
              : state.category
                ? '这个分类还没有笔记。'
                : '还没有笔记。'
      }

      if (elements.railList && elements.railEmpty) {
        var recentNotes = state.notes
          .slice()
          .sort(function (a, b) {
            return (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0)
          })
          .slice(0, 6)
        elements.railEmpty.hidden = recentNotes.length !== 0
        elements.railEmpty.textContent = state.loadFailed
          ? '加载失败，请刷新重试。'
          : state.loaded
            ? '暂无笔记。'
            : '正在加载…'
        elements.railList.innerHTML = recentNotes
          .map(function (note) {
            return (
              '<li><button type="button" data-action="read" data-id="' +
              escapeHtml(note.id) +
              '">' +
              escapeHtml(note.title) +
              '<time datetime="' +
              escapeHtml(note.updatedAt) +
              '">更新于 ' +
              escapeHtml(formatDate(note.updatedAt)) +
              '</time></button></li>'
            )
          })
          .join('')
      }

      elements.list.innerHTML = (folderOverview ? [] : state.filteredNotes)
        .map(function (note, index) {
          var anchorId = getMemoAnchorId(note, index)
          var actions = state.authenticated
            ? '<div class="memo-actions">' +
              '<button class="ghost-text-button" type="button" data-action="edit" data-id="' +
              escapeHtml(note.id) +
              '">编辑</button>' +
              '<button class="ghost-text-button danger-button" type="button" data-action="delete" data-id="' +
              escapeHtml(note.id) +
              '">删除</button>' +
              '</div>'
            : ''

          return (
            '<article class="memo-card" id="' +
            escapeHtml(anchorId) +
            '">' +
            '<div class="memo-card-head"><div>' +
            '<h2 class="memo-title"><button type="button" data-action="read" data-id="' +
            escapeHtml(note.id) +
            '">' +
            escapeHtml(note.title) +
            '</button></h2>' +
            '<p class="memo-time">' +
            escapeHtml(
              paraCategories.find(function (category) {
                return category.id === normalizeParaCategory(note.category)
              }).name
            ) +
            ' · ' +
            escapeHtml(formatDate(note.updatedAt)) +
            '</p>' +
            '</div></div>' +
            '<p class="memo-content memo-excerpt">' +
            escapeHtml(getExcerpt(note.content)) +
            '</p><div class="memo-card-footer"><button class="memo-read-button" type="button" data-action="read" data-id="' +
            escapeHtml(note.id) +
            '">阅读全文</button>' +
            actions +
            '</div>' +
            '</article>'
          )
        })
        .join('')
    }

    function getExcerpt(content) {
      var container = document.createElement('div')
      container.innerHTML = markdown.render(content)
      container
        .querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, pre, blockquote, tr, br')
        .forEach(function (node) {
          node.append(document.createTextNode('\n'))
        })
      return container.textContent.trim().replace(/\n+/g, '\n')
    }

    async function loadNotes() {
      var generation = ++dataGeneration
      try {
        var response = await fetch('/api/para-notes', { cache: 'no-store' })
        if (!response.ok) throw new Error('load failed')
        var data = await response.json()
        if (generation !== dataGeneration) return
        if (!Array.isArray(data.notes) || typeof data.revision !== 'string' || !data.revision) {
          throw new Error('invalid response')
        }
        state.notes = data.notes
        state.revision = data.revision
        state.loadFailed = false
      } catch {
        if (generation !== dataGeneration) return
        state.loadFailed = true
        setStatus('加载笔记失败，请稍后重试。', 'error')
      } finally {
        if (generation === dataGeneration) {
          state.loaded = true
          applySearch()
        }
      }
    }

    async function request(method, payload) {
      dataGeneration += 1
      setBusy(true)

      try {
        var response = await fetch('/api/para-notes', {
          method,
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            ...payload,
            revision: method === 'PUT' ? state.editingRevision : state.revision
          })
        })

        var data = await response.json().catch(function () {
          return {}
        })
        if (!response.ok) {
          if (response.status === 409) {
            await loadNotes()
            throw new Error('conflict')
          }
          throw new Error('request failed')
        }

        if (!Array.isArray(data.notes) || typeof data.revision !== 'string' || !data.revision) {
          throw new Error('invalid response')
        }
        state.notes = data.notes
        state.revision = data.revision
        state.loadFailed = false
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
        if (state.busy || !discardDraft()) return
        setAuthenticated(false)
        setStatus('已退出编辑模式。')
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
      unlockWithPasscode(getPasscode())
    }

    var onPasscodeInput = function () {
      unlockAttemptId += 1
      unlocking = false
      elements.unlock.disabled = false
      elements.unlock.textContent = '解锁编辑'
      elements.passcodeInput.removeAttribute('aria-busy')
    }

    var onFormSubmit = async function (event) {
      event.preventDefault()
      if (state.busy || !state.authenticated) return
      if (!state.loaded || state.loadFailed || !state.revision) {
        setStatus('笔记尚未成功加载，请刷新后再操作。当前内容已保留。', 'error')
        return
      }

      var passcode = getPasscode() || sessionStorage.getItem(storageKey) || ''
      var title = elements.title instanceof HTMLInputElement ? elements.title.value.trim() : ''
      var content =
        elements.content instanceof HTMLTextAreaElement ? elements.content.value.trim() : ''
      var category = elements.category.value

      if (!passcode) {
        setStatus('缺少管理员口令。', 'error')
        return
      }

      if (!title || !content) {
        setStatus('标题和内容不能为空。', 'error')
        return
      }

      try {
        if (state.editingId) {
          await request('PUT', {
            id: state.editingId,
            title: title,
            content: content,
            category: category,
            passcode: passcode
          })
          setStatus('笔记已更新。')
        } else {
          await request('POST', {
            title: title,
            content: content,
            category: category,
            passcode: passcode
          })
          setStatus('笔记已保存。')
        }

        state.category = category
        applySearch()
        resetForm()
      } catch (error) {
        setStatus(
          error instanceof Error && error.message === 'conflict'
            ? '笔记已发生变化，未覆盖任何修改。请复制当前草稿后，重新打开笔记并合并修改。'
            : '保存失败，请重试。当前内容已保留。',
          'error'
        )
      }
    }

    var onCancelEditClick = function () {
      if (!discardDraft()) return
      resetForm()
      setEditorMode('split')
      elements.title.focus()
      setStatus('可以开始写新笔记了。')
    }

    var onListClick = async function (event) {
      var target = event.target
      if (!(target instanceof HTMLElement)) return

      var button = target.closest('[data-action]')
      if (!button || state.busy) return
      var action = button.dataset.action
      var id = button.dataset.id
      if (!action || !id) return

      var note = state.notes.find(function (item) {
        return item.id === id
      })
      if (!note) return

      if (action === 'read') {
        elements.readerTitle.textContent = note.title
        elements.readerTime.textContent = '更新于 ' + formatDate(note.updatedAt)
        elements.readerContent.innerHTML = markdown.render(note.content)
        showModal('reader')
        elements.readerContent.scrollTop = 0
        return
      }
      if (!state.authenticated) return

      if (action === 'edit') {
        beginEdit(note)
        return
      }

      if (action === 'delete') {
        var passcode = getPasscode() || sessionStorage.getItem(storageKey) || ''
        if (!passcode) {
          setStatus('缺少管理员口令。', 'error')
          return
        }

        if (!window.confirm('确定删除笔记「' + note.title + '」？')) return

        try {
          await request('DELETE', { id: id, passcode: passcode })
          if (state.editingId === id) resetForm()
          setStatus('笔记已删除。')
        } catch (error) {
          setStatus(
            error instanceof Error && error.message === 'conflict'
              ? '笔记已发生变化，本次未删除。请核对最新内容后重试。'
              : '删除失败，请重试。',
            'error'
          )
        }
      }
    }

    var onDocumentClick = function (event) {
      var target = event.target
      if (!(target instanceof Element)) return

      var closeControl = target.closest('[data-close-modal]')
      if (closeControl) hideModal(closeControl.dataset.closeModal)
    }

    var onCategoryClick = function (event) {
      var button = event.target.closest('[data-category]')
      if (!button) return
      state.category = button.dataset.category
      applySearch()
      if (!state.editingId && draftValue() === originalDraft) resetForm()
      elements.showAll.focus()
    }
    var onShowAll = function () {
      var previousCategory = state.category
      state.category = ''
      state.keyword = ''
      elements.searchInput.value = ''
      applySearch()
      var folder = elements.categories.querySelector('[data-category="' + previousCategory + '"]')
      ;(folder || elements.categories.querySelector('[data-category]')).focus()
    }

    var onDocumentKeydown = function (event) {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 's' &&
        state.authenticated
      ) {
        event.preventDefault()
        if (!state.busy) elements.form.requestSubmit()
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        ['b', 'i'].includes(event.key.toLowerCase()) &&
        event.target === elements.content
      ) {
        event.preventDefault()
        insertFormat(event.key.toLowerCase() === 'b' ? 'bold' : 'italic')
      }
      if (event.key !== 'Escape') return
      if (!activeModal) return
      event.preventDefault()
      hideModal(activeModal)
    }

    var onEditorClick = function (event) {
      var button = event.target.closest('button')
      if (!button || state.busy) return
      if (button.dataset.editorCategory) setEditorCategory(button.dataset.editorCategory)
      if (button.dataset.mode) setEditorMode(button.dataset.mode)
      if (button.dataset.format) insertFormat(button.dataset.format)
    }
    var onBeforeUnload = function (event) {
      if (state.authenticated && draftValue() !== originalDraft) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    var onBeforeNavigate = function (event) {
      if (state.authenticated && (state.busy || !discardDraft())) event.preventDefault()
    }
    var onModalCancel = function (event) {
      event.preventDefault()
      if (activeModal) hideModal(activeModal)
    }
    elements.readerModal.addEventListener('cancel', onModalCancel)
    elements.searchModal.addEventListener('cancel', onModalCancel)
    elements.passcodeModal.addEventListener('cancel', onModalCancel)
    document.addEventListener('astro:before-preparation', onBeforeNavigate)
    elements.form.addEventListener('click', onEditorClick)
    elements.content.addEventListener('input', updatePreview)
    var onContentInvalid = function () {
      setEditorMode('write')
    }
    elements.content.addEventListener('invalid', onContentInvalid)
    window.addEventListener('beforeunload', onBeforeUnload)
    originalDraft = draftValue()
    setEditorMode('split')
    updatePreview()

    if (elements.searchToggle) elements.searchToggle.addEventListener('click', onSearchToggleClick)
    if (elements.editToggle) elements.editToggle.addEventListener('click', onEditToggleClick)
    if (elements.searchInput) elements.searchInput.addEventListener('input', onSearchInput)
    if (elements.passcodeForm) elements.passcodeForm.addEventListener('submit', onPasscodeSubmit)
    if (elements.passcodeInput) elements.passcodeInput.addEventListener('input', onPasscodeInput)
    if (elements.form) elements.form.addEventListener('submit', onFormSubmit)
    if (elements.cancelEdit) elements.cancelEdit.addEventListener('click', onCancelEditClick)
    if (elements.list) elements.list.addEventListener('click', onListClick)
    elements.railList.addEventListener('click', onListClick)
    elements.categories.addEventListener('click', onCategoryClick)
    elements.showAll.addEventListener('click', onShowAll)
    document.addEventListener('click', onDocumentClick)
    document.addEventListener('keydown', onDocumentKeydown)

    var rememberedPasscode = sessionStorage.getItem(storageKey)
    if (rememberedPasscode && elements.passcodeInput instanceof HTMLInputElement) {
      elements.passcodeInput.value = rememberedPasscode
      unlockWithPasscode(rememberedPasscode)
    } else {
      setAuthenticated(false)
    }

    loadNotes()

    cleanupCurrentPage = function () {
      hideToast()
      elements.readerModal.removeEventListener('cancel', onModalCancel)
      elements.searchModal.removeEventListener('cancel', onModalCancel)
      elements.passcodeModal.removeEventListener('cancel', onModalCancel)
      document.removeEventListener('astro:before-preparation', onBeforeNavigate)
      elements.form.removeEventListener('click', onEditorClick)
      elements.content.removeEventListener('input', updatePreview)
      elements.content.removeEventListener('invalid', onContentInvalid)
      hideModal('search', true)
      hideModal('passcode', true)
      hideModal('reader', true)
      window.removeEventListener('beforeunload', onBeforeUnload)
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
      elements.railList.removeEventListener('click', onListClick)
      elements.categories.removeEventListener('click', onCategoryClick)
      elements.showAll.removeEventListener('click', onShowAll)
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
