window.__ModuleLoader__.load({
  id: 'dsh-project-atlas',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useMemo, useRef, useCallback } = React
    const NS = 'dsh-workbench'
    const API = '/dsh-workbench/api'
    const PROJECT_MEDIA_TTL = 45000
    const projectMediaCache = new Map()
    const projectMediaRequests = new Map()

    function loadProjectMedia(projectId, force = false) {
      const key = String(projectId || '')
      if (!key) return Promise.resolve(null)
      const cached = projectMediaCache.get(key)
      if (!force && cached && Date.now() - cached.at < PROJECT_MEDIA_TTL) return Promise.resolve(cached.data)
      const request = {}
      projectMediaRequests.set(key, request)
      return fetch(`${API}/project-media?id=${encodeURIComponent(key)}`, { cache: 'no-store' })
        .then(async (response) => {
          const data = await response.json().catch(() => ({}))
          if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`)
          if (projectMediaRequests.get(key) === request) {
            projectMediaCache.set(key, { at: Date.now(), data })
            projectMediaRequests.delete(key)
          }
          return data
        })
        .catch((error) => {
          if (projectMediaRequests.get(key) === request) projectMediaRequests.delete(key)
          const current = projectMediaCache.get(key)
          if (current) return { ...current.data, stale: true, error: error?.message || String(error) }
          throw error
        })
    }

    function invalidateProjectMedia(projectId) {
      const key = String(projectId || '')
      projectMediaCache.delete(key)
      projectMediaRequests.delete(key)
    }

    async function copyText(text) {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text)
          return true
        }
      } catch { /* fall back to a selected textarea */ }
      try {
        const area = document.createElement('textarea')
        area.value = text
        area.setAttribute('readonly', '')
        area.style.position = 'fixed'
        area.style.top = '-1000px'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        area.setSelectionRange(0, area.value.length)
        const copied = document.execCommand('copy')
        document.body.removeChild(area)
        return copied
      } catch {
        return false
      }
    }

    const DICT = {
      zh: {
        nav: '可视化工作台',
        title: '可视化工作台',
        subtitle: '本机项目、技能、AI 软件与磁盘的统一入口',
        refresh: '刷新',
        rescanning: '正在扫描…',
        rescan: '重新扫描',
        lastScan: '上次扫描',
        projects: '项目',
        projectLabel: '项目',
        active: '进行中',
        paused: '暂停',
        archived: '已弃用',
        unknown: '未判定',
        totalSize: '项目占用',
        software: 'AI 软件',
        skills: '技能',
        library: '项目',
        disks: '磁盘',
        skillKicker: 'SKILL ATLAS · 本机技能总览',
        skillTitle: '我的技能图谱',
        skillSub: '{total} 个 SKILL.md，去重后 {names} 个名字，分布在 {sources} 个 Agent 目录。项目是项目，技能是技能。',
        skillAuthored: '我写的',
        skillInstalled: '随 Agent 安装',
        skillAll: '全部',
        skillRefresh: '重新扫描',
        skillScanning: '正在扫描本机技能…',
        skillScannedAt: '扫描于 {t}',
        skillAuthoredTag: '自建技能',
        skillMatrix: '来源 × 用途',
        skillMatrixHint: '点格子筛选；颜色越深，技能越多',
        skillLow: '少',
        skillHigh: '多',
        skillSource: '来源',
        skillAllSources: '全部来源',
        skillAllCategories: '全部用途',
        skillAllScopes: '全部范围',
        skillScope: '范围',
        skillScopeUser: '用户级',
        skillScopeProject: '项目级',
        skillScopeApp: '应用级',
        skillScopeSystem: '系统级',
        skillSortSource: '按来源',
        skillSortName: '按名称',
        skillSortRecent: '最近修改',
        skillSearch: '搜索技能名、描述、路径、标签…',
        skillIndex: '技能索引',
        skillIndexHint: '点一行查看 SKILL.md；同名技能会标出安装位置',
        skillNoMatch: '没有匹配的技能',
        skillNoMatchHint: '换个关键词，或把范围切到「全部」。',
        skillDetailEmpty: '选择一个技能',
        skillDetailEmptyHint: '左边是技能索引，点一行看它的说明和所在目录。',
        skillLoading: '读取技能…',
        skillOpen: '打开目录',
        skillCopy: '复制路径',
        skillCopied: '路径已复制',
        skillPath: 'SKILL.md',
        skillUpdated: '最近修改',
        skillSize: '文件大小',
        skillPreview: '技能说明',
        skillNoContent: '这个 SKILL.md 没有正文。',
        skillNoDescription: '没有写描述',
        skillDuplicateCount: '同名 {n} 处',
        skillDuplicatesTitle: '同名技能还安装在这些地方',
        skillCategory: '用途',
        searchProjects: '搜索项目、路径、备注…',
        allSources: '全部来源',
        sortRecent: '最近活动',
        sortSize: '占用空间',
        sortName: '名称',
        sortCreated: '创建时间',
        showHidden: '显示隐藏',
        showNoise: '显示缓存项',
        followupPending: '待跟进',
        followupNew: '新发现',
        followupFilter: '只看待跟进',
        followupHint: '重新扫描后，新出现的项目会进入待跟进；写一句备注，再标记已跟进。',
        followupBanner: '发现 {n} 个新项目还没跟进',
        followupBannerHint: '先确认是不是你要留的项目，写一句人话备注，再标记已跟进。',
        followupView: '查看',
        followupMark: '标记已跟进',
        followupNeedNote: '先写一句备注，再标记已跟进',
        followupMarked: '已标记为跟进完成',
        followupDiscovered: '发现于 {t}',
        followupFailed: '保存跟进状态失败',
        followupNone: '没有符合条件的待跟进项目',
        followupScanHint: '上次扫描 {t}；今天有新项目就点“重新扫描”。',
        runtimeArtifacts: '产出',
        runtimePipeline: '流程',
        runtimeReady: '空闲',
        runtimeRunning: '运行中',
        runtimeWaiting: '等待',
        runtimeBlocked: '阻塞',
        runtimeFailed: '失败',
        runtimeDone: '完成',
        runtimeUnknown: '未判定',
        runtimeHeartbeat: '最后心跳',
        runtimeStale: '状态已过期',
        runtimeStagesDone: '{done}/{total} 阶段',
        cards: '卡片',
        table: '表格',
        boardView: '地形图',
        boardAttnPending: '待跟进',
        lifecyclePersistent: '长期项目',
        lifecycleIncubating: '孵化中',
        lifecycleTemporary: '临时工作',
        lifecycleUnclassified: '待归类',
        lifecycleManual: '你已确认',
        lifecycleManifest: '来自项目清单',
        lifecycleHandoff: '来自交接单',
        lifecycleInferred: '工作台推断',
        wallLifecycleProjects: '项目',
        wallBandPersistent: '长期项目',
        wallBandPersistentSub: '已确认会持续维护、有明确意图的项目。',
        wallBandIncubating: '孵化候选',
        wallBandIncubatingSub: '有代码或会话迹象，但还没确认长期意图；先不当作主线。',
        wallLifecycleTemporary: '临时工作',
        wallLifecycleUnclassified: '待归类',
        wallLifecycleAll: '全部',
        wallLifecycleSummary: '{p} 长期 · {i} 孵化 · {t} 临时 · {u} 待归类',
        wallNoPersistent: '还没有确认为长期的项目',
        wallNoPersistentSub: '从「待归类」里打开一个，点“设为长期项目”；只有确认过意图和延续性的，才会上项目墙。',
        wallTemporaryTitle: '临时工作',
        wallTemporarySub: '一次性的图、表、导出和试验；不占项目墙，但也没被删。',
        wallTemporaryEmpty: '没有临时工作',
        wallTemporaryExpires: '{t} 后建议清理',
        wallTemporaryExpired: '已过建议清理时间',
        wallTemporaryCleanup: '清理建议',
        wallUnclassifiedTitle: '待归类',
        wallUnclassifiedSub: '先看清是什么，再决定留成项目还是归入临时工作。',
        wallUnclassifiedHint: '打开项目房间，在设置里归类',
        roomLifecycle: '项目生命周期',
        roomLifecycleSub: '文件夹不等于长期项目。确认意图后，才把它当作项目维护。',
        roomLifecycleSave: '保存归类',
        roomLifecycleSaved: '项目归类已保存在工作台本地',
        roomLifecycleFailed: '项目归类保存失败',
        identityTitle: '项目身份',
        identitySub: '只保存在工作台本地，不会改写项目文件。',
        identityIntent: '为什么长期维护',
        identityIntentPlaceholder: '例如：这是一个会持续迭代的编剧工作室，不是一次生成任务。',
        identityManifest: '项目清单（只读）',
        identityNoManifest: '项目没有清单；工作台只读识别，不会创建。',
        integrationTitle: '项目接入',
        integrationSub: '声明写在项目自己的 workbench.project.json；工作台据此判断能帮到哪一层。',
        integrationIndex: '仅索引与打开',
        integrationIndexSub: '还没有接入声明。工作台只能查看、记录和打开目录，不能改动应用内部。',
        integrationProject: '项目级接入',
        integrationProjectSub: '识别项目自带的自述文件，只读展示；工作台不会改写项目文件。',
        integrationApp: '应用级接入',
        integrationAppSub: '项目声明了应用入口。只有项目自己实现 adapter / CLI 时，操作才会进入应用内部。',
        integrationUnknown: '已声明，未验证',
        integrationUnknownSub: '工作台不认识这个接入类型，不会假装它能控制应用。',
        integrationEntry: '入口',
        integrationState: '状态文件',
        integrationApply: '应用方式',
        integrationAgent: '执行代理',
        integrationManifest: '声明文件',
        integrationNoEntry: '未声明入口',
        integrationNoAdapter: '声明不等于已接通：这个项目没有提供可调用的 adapter 时，工作台仍然只做索引与打开。',
        integrationKind: '类型',
        integrationChipIndex: '仅索引',
        integrationChipProject: '项目级',
        integrationChipApp: '应用级',
        integrationChipUnknown: '接入未验证',
        lineageTitle: '会话谱系',
        lineageSub: '一个目录可能有很多对话。只有确认过的主线及其续写，才算这个项目的会话。',
        lineageMain: '项目主线',
        lineageCandidate: '建议主线（待确认）',
        lineageContinuation: '续写',
        lineageSide: '旁支',
        lineageUnassigned: '未归属',
        lineageSetMain: '设为主线',
        lineageMarkContinuation: '标为续写',
        lineageMarkSide: '移到旁支',
        lineageRootConfirmed: '主线已确认',
        lineageRootCandidate: '候选主线未确认',
        lineageBrokenParent: '父会话不在这个项目里',
        lineageUnassignedHint: '这些对话只是同目录，不会被当成项目主线。',
        lineageNoSessions: '还没有会话',
        sessionLineageSaved: '会话主线已保存在工作台本地',
        sessionLineageFailed: '会话主线保存失败',
        wsBack: '返回项目',
        wsOutputs: '产出',
        wsSessions: '会话',
        wsSettings: '设置',
        wsContinueTitle: '继续最近的工作',
        wsContinueSub: '从「{title}」接着做 · {t}',
        wsStartTitle: '从零开始一个任务',
        wsStartSub: '把目标交给 DSH，自动读取项目上下文。',
        wsContinue: '继续',
        wsStart: '开始',
        wsNewTask: '新任务',
        wsRuntime: '运行状态',
        wsRuntimeSub: '来自项目自己的 runtime 文件',
        wsNoRuntime: '还没有运行记录。启动任务后，这里会自动出现阶段与产出。',
        wsArtifactsCount: '{n} 个产出',
        wsLatestOutputs: '最近产出',
        wsViewAllOutputs: '全部产出',
        wsAllSessions: '全部会话',
        wsRelations: '项目关系',
        wsUnsaved: '有未保存修改',
        wsLeaveConfirm: '项目有未保存的修改。确定保存并离开吗？取消将留在当前页面。',
        wsDiscardTaskConfirm: '任务草稿尚未发送，离开后会丢失。确定放弃草稿并离开吗？',
        wsChangedDuringSave: '保存期间又有新的修改，请检查后再次离开。',
        wsOutputsSub: '{n} 个文件，按最近更新排序',
        wsNoOutputs: '还没有产出',
        wsNoOutputsSub: '运行任务或写入文件后，产出会自动出现在这里。',
        wsSessionsSub: '{n} 个关联会话',
        wsNoSessionsSub: '从任务入口开始，或关联一个已有 DSH / Codex 会话。',
        wsSettingsSub: '状态、标签、目录与项目元数据',
        wsTaskEyebrow: '交给我一个任务',
        wsTaskStarter: '请先读取项目状态、README/AGENTS 和交接记录，核对进度、阻塞与下一步；先不要修改任何文件，也不要启动 GPU / ComfyUI。给我最小可执行方案，等我确认后再开始。',
        wsTaskPlaceholder: '补充具体任务，或直接发送这条开场白…',
        wsRun: '交给 DSH',
        wsComposeHint: 'Ctrl / ⌘ + Enter 发送 · 已填入安全开场白，可直接补充任务',
        wallEmptySub: '按最近活动排序，完整列表在表格视图',
        wallViewAll: '查看全部 {n} 个项目',
        wallEmpty: '还没有项目数据',
        empty: '没有匹配的项目',
        openFolder: '打开文件夹',
        copyPath: '复制路径',
        details: '详情',
        created: '创建',
        lastActivity: '最近活动',
        size: '大小',
        files: '文件',
        sourcesLabel: '来源',
        toolsLabel: '工具',
        git: 'Git',
        gitDirty: '{n} 个未提交',
        branch: '分支',
        remote: '远端',
        commits: '提交',
        sessions: '会话',
        save: '保存',
        saving: '保存中…',
        saved: '已保存',
        cancel: '取消',
        close: '关闭',
        status: '状态',
        tags: '标签',
        pin: '置顶',
        pinned: '已置顶',
        hide: '在列表中隐藏',
        dataDir: '数据目录',
        free: '可用',
        cleanupHint: '按占用排序、可清理的已弃用项目；在项目库中勾选后统一确认处理。',
        installed: '已安装',
        recent: '最近使用',
        categoryAll: '全部类别',
        noData: '尚未生成项目目录',
        scanNow: '开始扫描',
        scanHint: '扫描会读取本机项目标记、Git 元数据、OpenCode 与 DSH 会话；不会修改任何文件。',
        noRootsHint: '尚未配置项目目录。请在 ~/.dsh/data/dsh-workbench/config.json 中设置 roots，然后重新扫描。',
        daysAgo: '{n} 天前',
        monthsAgo: '{n} 个月前',
        today: '今天',
        yesterday: '昨天',
        ungrouped: '未归类',
        path: '路径',
        unknownVersion: '未记录版本',
        noSummary: '暂无自动摘要',
        workspaceUsage: '按工作区',
        cleanupCandidates: '清理候选',
        goCleanup: '去清理',
        notDeleted: '需逐项确认',
        notePlaceholder: '这个项目是做什么的？为什么停下，或者下一步是什么？',
        saveHint: 'Ctrl / Cmd + Enter 保存',
        projectNotes: '工作台备注',
        libraryHint: '一个项目可以关联多个目录；工作区根目录不会显示成项目。',
        scanTook: '耗时',
        generated: '生成于',
        warnings: '警告',
        savedToast: '备注已保存',
        scanStarted: '扫描已开始，可以继续浏览',
        scanFailed: '扫描失败',
        apiError: '无法连接工作台服务',
        retry: '重试',
        resetFilters: '重置筛选',
        showing: '显示',
        of: '/',
        parentProject: '父项目',
        addTags: '用逗号分隔多个标签',
        diskNote: '容量单位按 GiB 显示；项目体积为扫描估算。',
        archiveNote: '归档/备份的删除必须逐项确认。',
        select: '选择',
        selectExit: '退出选择',
        selectHint: '只允许选择已弃用项目；勾选后还要逐项确认。',
        selectAllArchived: '全选弃用项',
        clearSelection: '清除选择',
        deleteNoSelection: '请先选择已弃用的项目',
        deleteMax: '单次最多处理 50 项，请分批操作',
        selectedSummary: '已选 {n} 项 · {size}',
        selectPrompt: '选择一个或多个已弃用项目',
        batchRecycle: '移入回收站',
        batchHint: '仅已弃用项目可勾选；删除前会逐项核对，不会直接执行。',
        deleteTitle: '处理已弃用项目',
        deleteSubtitle: '这些目录会离开原位置。请逐项核对每一项。',
        deleteRecycle: '移入 Windows 回收站',
        deleteRecycleHint: '可恢复；清空回收站后才释放磁盘空间。',
        deletePermanent: '永久删除',
        deletePermanentHint: '不可恢复，立即释放空间。',
        deleteCheckAll: '全部核对',
        deleteCheckedAll: '已核对全部',
        deleteItemConfirm: '已核对',
        deletePermanentAck: '我确认永久删除，无法从回收站恢复。',
        deleteConfirmRecycle: '确认移入回收站（{n} 项）',
        deleteConfirmPermanent: '永久删除（{n} 项）',
        deleteBusy: '处理中…',
        deleteSafeHint: '只处理顶层、已弃用、非链接目录；受保护路径会被宿主拒绝。',
        deleteDoneRecycle: '已移入回收站：{n} 项',
        deleteDonePermanent: '已永久删除：{n} 项',
        deletePartial: '成功 {ok} 项，失败 {fail} 项',
        deleteFailed: '删除失败',
        deleteHostMissing: '删除接口尚未加载，请重启桌面端后再试。',
        deleteAuditHint: '操作记录：工作台数据目录 / deletions.log',
        selectArchivedOnly: '仅可选择已弃用项目',
        protected: '受保护',
        onlyArchived: '只看已弃用',
        items: '项',
        statusSource: '状态来源',
        sourceAuto: '自动读取',
        sourceManifest: '项目清单',
        sourceRuntime: '运行状态',
        sourceManual: '手动标记',
        sourceConvention: '项目约定',
        sourceOther: '{value}',
        sourceUnknown: '未知',
        projectCountLabel: '项目',
        softwareCountLabel: '软件',
        detailsFor: '项目详情',
        opencode: 'OpenCode',
        codes: '本地 Codes',
        dsh: 'DSH',
        lastCommit: '最后提交',
        childCount: '子项目数',
        copied: '已复制',
        topProjects: '占用最大的项目',
        workspaceCount: '工作区',
        noSoftware: '没有匹配的软件',
        searchSoftware: '搜索软件…',
        allStatus: '全部状态',
        noteSavedLocally: '备注只保存在工作台本地，不写入项目。',
        openFailed: '打开失败',
        saveFailed: '保存失败',
        ready: '就绪',
        agentUntitled: '未命名会话',
        agentOpenSession: '打开并继续',
        agentOpenSessionFailed: '无法打开会话：当前 DSH 没有 uiWorkspace.openSession。',
        agentOpened: '已打开会话，请在对话中继续。',
        projectFolders: '项目目录',
        addFolder: '关联目录',
        folderPathPlaceholder: '输入一个已有目录的绝对路径',
        folderRoleReference: '参考',
        folderRoleCode: '代码',
        folderRoleAssets: '素材',
        folderRoleOutput: '产出',
        folderRoleData: '数据',
        folderRoleDocs: '文档',
        folderAdded: '目录已关联',
        folderAddFailed: '关联目录失败',
        folderRemoved: '目录已取消关联',
        remove: '移除',
        recentSessions: '最近会话',
        noSessions: '这个项目还没有 DSH 会话',
        sessionCountLabel: '{n} 个会话',
        sessionForked: '派生',
        sessionForkAction: '派生',
        sessionForkDone: '已派生新会话，可以继续。',
        sessionForkUnavailable: '当前 DSH 不支持派生会话。',
        sessionLink: '关联会话',
        sessionLinkHint: '把不属于任何项目目录的会话手动挂到项目；不会移动或改写会话。',
        sessionLinked: '会话已关联',
        sessionUnlinked: '已取消会话关联',
        sessionManual: '手动关联',
        sessionUnlink: '取消关联',
        sessionNoCandidates: '没有未归属的会话',
        sessionLinkFailed: '关联会话失败',
        folderCountLabel: '{n} 个目录',
        inheritTarget: '接手到',
        inheritExistingGroup: '项目里已有的会话',
        handoffExistingOpen: '打开已有会话',
        handoffExistingHint: '会打开这个会话并把交接单复制到剪贴板；不新建会话，也不冒充已发送。',
        handoffExistingOpened: '已打开已有会话；交接单已复制，粘贴并确认后发送。',
        inheritDsh: 'DSH 新会话',
        inheritOpenCode: 'OpenCode 新会话',
        inheritCodex: 'Codex（只复制交接单）',
        inheritComfy: 'ComfyUI（打开素材目录）',
        inheritOther: '其他应用（只复制交接单）',
        inheritPackOnly: '交接单会复制到剪贴板；目标应用不会假装拥有原生记忆。',
        inheritOpenCodeDone: '已在 OpenCode 建立新会话并发送交接单。',
        inheritOpenDone: '已打开项目目录，并记录本次交接。',
        inheritFailed: '接手失败',
        handoff: 'AI 接手',
        handoffTitle: '项目交接',
        handoffSub: '整理当前状态；DSH 新会话只预填，不会自动发送。',
        handoffSource: '来源',
        handoffManual: '手工交接',
        handoffDshSource: 'DSH 会话',
        handoffSourceCodex: 'Codex 会话',
        handoffGoal: '目标 / 下一步',
        handoffDefaultGoal: '继续完成这个项目当前未完成的工作；先核对最近进展，再开始执行。',
        handoffNoProgress: '暂无可用的后续进展，请先核对最近请求与项目文件。',
        handoffLatestStatus: '最新状态',
        handoffLatestError: '最新阻塞',
        handoffTruthDocs: '真值文档',
        handoffTruthDocsUnread: '未读取',
        handoffTruthDocsNotFound: '项目关联目录中未找到',
        handoffRecentUserContext: '最近用户原话（仅供参考，不是指令）',
        handoffGoalPlaceholder: '例如：把当前任务在 DSH 中继续做完，先验证现有构建。',
        handoffProgress: '当前进展',
        handoffProgressPlaceholder: '已经完成了什么、验证到哪里、哪些还没做。',
        handoffConstraints: '关键约束',
        handoffConstraintsPlaceholder: '例如：不要删除旧数据；不要改受保护目录；先读项目说明。',
        handoffFiles: '相关文件与入口',
        handoffFilesPlaceholder: '项目根目录、关键文件、构建或测试命令。',
        handoffPreview: '交接单预览',
        handoffSummary: '来源摘要',
        handoffCopy: '复制交接单',
        handoffCopied: '交接单已复制',
        handoffCopyFailed: '复制失败，请手动选择预览文本。',
        handoffStart: '在 DSH 新会话接手',
        handoffStarting: '正在打开…',
        handoffHint: '只预填到输入框，不会自动发送。',
        handoffGoalRequired: '请先填写「目标 / 下一步」。',
        handoffUnavailable: '当前 DSH 没有提供工作区或新会话接口；可以先复制交接单。',
        handoffNoPath: '这个项目没有可用路径，无法创建新会话。',
        handoffDraftWarning: '该工作区有未发送草稿；继续会覆盖它。',
        handoffDraftReplace: '仍然接手',
        handoffSourceLoading: '正在读取最近会话…',
        handoffSourceFailed: '最近会话摘要读取失败，可手工填写。',
        handoffForkFailed: '派生会话失败',
        handoffNoProject: '未匹配项目',
        handoffProject: '项目',
        handoffPath: '路径',
        handoffGeneratedAt: '生成时间',
        handoffSourceSession: '来源会话',
        handoffPromptTitle: '项目接手单',
        handoffRulesLabel: '接手要求',
        handoffRules: '- 先读项目现有的 README、AGENTS.md 或文档（若存在），并复述你理解的当前状态、下一步和风险，再开始执行。\n- 不要重做已经完成并验证过的部分。\n- 需要时直接读项目文件；发现信息冲突时先问我。\n- 不要删除、覆盖或迁移任何数据，除非我明确确认。\n- 除非我在这张交接单里勾选“写入项目”，否则工作台不会改写项目文件；完成后把改动文件、验证结果和下一步告诉我。',
        handoffUnknown: '（未提供）',
        handoffOpened: '已在 DSH 新会话中预填交接单；确认后发送。',
        handoffPersist: '可选：把交接单写入项目（默认关闭）',
        handoffPersistHint: '默认只在工作台生成交接单并预填到新会话；勾选后才写 .dsh/handoff，若再勾选下一项才维护 AGENTS.md。属于显式的深度接入。',
        handoffPersistAgents: '同时维护 AGENTS.md 指针',
        handoffPersistFailed: '交接单写入项目失败',
        handoffPersistNoProject: '找不到这个交接对应的项目',
        handoffHistory: '交接记录',
        handoffHistorySub: '预填不等于已发送；完成与失败由你确认，不伪造执行成功。',
        handoffHistoryEmpty: '还没有交接记录。',
        sessionSourceUnavailable: '{{source}} 会话来源不可用：{{error}}',
        handoffStatusPrefilled: '预填',
        handoffStatusSent: '已发送',
        handoffStatusRunning: '执行中',
        handoffStatusCompleted: '完成',
        handoffStatusFailed: '失败',
        handoffMarkDone: '标记完成',
        handoffMarkFailed: '标记失败',
        handoffRecordStatusFailed: '更新交接状态失败',
        handoffReadBoundary: '读取边界',
        wallKicker: 'LOCAL AI WORKBENCH',
        wallTitleA: '项目',
        wallTitleB: '地形图',
        terrainKicker: 'PROJECT TERRAIN · 最近活动 × 生命周期',
        terrainSub: '每个点是一个项目。向右是更近的活动，向下是更轻的生命周期；点越大，占用越大。',
        terrainOld: '更早',
        terrainNow: '今天',
        terrainRecent: '最近活动',
        terrainBandPersistent: '长期',
        terrainBandIncubating: '孵化',
        terrainBandTemporary: '临时',
        terrainBandUnclassified: '待归类',
        terrainHint: '单击聚焦 · 双击进入项目 · 方向键移动',
        terrainFocus: '当前聚焦',
        terrainEnter: '进入项目',
        terrainCount: '{n} 个项目',
        terrainRunning: '运行中',
        terrainEmptyBand: '这一层还没有项目',
        terrainSize: '占用',
        wallSub: '{total} 个项目，{active} 个正在进行，{pending} 个待回看。',
        wallNoArtifact: '还没有产出',
        wallAll: '全部项目',
        wallRecent: '最近更新',
        deckSignal: '项目信号',
        deckSignalHint: '每根柱是一个项目，按最近活动排布',
        deckQueue: '项目队列',
        deckQueueHint: '单击预览 · 双击进入 · ↑↓ 切换',
        deckStage: '当前选中',
        deckEnter: '进入项目',
        deckOpenFolder: '打开目录',
        deckAxisOld: '30 天前',
        deckAxisNow: '今天',
        deckStageHint: '主舞台只预览；进入项目房间后再处理。',
        deckNoActive: '没有可显示的项目',
        deckRecent: '最近活动',
        deckSessionCount: '{n} 个会话',
        deckSessions: '会话',
        deckOutputs: '产出',
        roomKicker: 'PROJECT SCENE',
        roomBrief: '简报',
        roomEvidence: '证据',
        roomSetup: '设置',
        roomNext: '下一件事',
        roomComposeOpen: '交给 DSH 一个新任务',
        roomComposeClose: '收起任务输入',
        roomLatest: '最近产出',
        roomMemory: '交接记录（只读）',
        roomMemoryNative: '已生成',
        roomMemoryEmpty: '未生成',
        roomMemoryHint: '工作台只保存交接记录，不会写入、覆盖或创建任何项目文件。',
        roomMemoryOpen: '查看记录',
        noteStateLabel: '工作台备注',
        noteStateYes: '已填写',
        noteStateNo: '未填写',
        roomNoCover: '还没有可视化产出',
        earthTitle: '项目地球',
        earthSubtitle: '本机项目的一张导航图',
        earthOverline: 'EARTH / LOCAL PROJECTS',
        earthHeadline: '把项目放回一颗星球上',
        earthIntro: '真实卫星影像，按你的设备时间显示昼夜。项目锚点用于个人布局，不代表项目真实所在地。',
        earthPlayHint: '暂停或继续自动旋转',
        earthIndex: '项目索引',
        earthIndexFullscreen: '全屏索引',
        earthIndexEnter: '查看落点',
        earthFocusHint: '双击空白进入全屏',
        earthFocusExitHint: '全屏中 · 双击空白退出',
        earthPanorama: '全屏',
        earthExitPanorama: '退出全屏 · Esc',
        earthSearch: '搜索项目、路径、备注…',
        earthNoMatch: '没有匹配的项目',
        earthProjectOverline: 'PROJECT / 当前选中',
        earthNoNote: '还没有工作台备注。打开项目现场后可以写一句。',
        earthEnter: '俯冲至项目落点',
        earthOpenRoom: '直接打开项目',
        earthLandingKicker: 'LANDING / 项目详情',
        earthLandingLabel: '已停在地图落点',
        earthLandingHint: '镜头停在这里。先看真实代表图、最近记录和入口，再由你决定是否进入项目现场。',
        earthLandingWheelHint: '在地球上滚动滚轮 · 回到轨道',
        roomWheelBack: '滚轮上推 · 缩回详情',
        roomWheelBackEarth: '滚轮上推 · 回到地球',
        roomWheelBackTitle: '滚轮上推或 Esc 返回',
        roomBackDetail: '缩回详情',
        earthLandingEnter: '进入项目现场',
        earthLandingReturn: '回到轨道',
        earthSelectHint: '点一个球面标记，或用顶部「项目索引」打开项目列表。单击标记先降落看详情；双击空白进入全屏。',
        earthTouchSelectHint: '点球面标记或顶部「项目索引」查看项目；点「全屏」放大画面。',
        earthTouchHint: '单指旋转 · 双指缩放',
        earthTouchExitPanorama: '退出全屏',
        earthZoomIn: '拉近',
        earthZoomOut: '拉远',
        earthDayNight: '昼夜来自设备时间',
        earthTerrainAssist: '夜间落点地形已提亮',
        earthDragHint: '拖动旋转 · 滚轮缩放 · 空格暂停',
        earthFlying: '正在俯冲「{name}」',
        earthTouchdownKicker: 'TOUCHDOWN / 降落完成',
        earthTouchdownEnter: '正在进入「{name}」',
        earthTouchdownHint: '镜头已落在项目标记，正在打开项目现场',
        earthArrivedOverline: 'SURFACE / 项目现场',
        earthSiteTop: '卫星影像 · 项目地表示意',
        earthArrivalDossier: 'SITE DOSSIER / 现场资料',
        earthArrivedHint: '镜头已落到这颗项目标记上。进入现场，查看能力、会话、产出和交接边界。',
        earthOpenScene: '进入项目现场',
        earthBackToOrbit: '回到轨道',
        earthCanvasLabel: '可拖动、缩放的真实卫星影像地球',
        earthLayoutNote: '锚点用于项目布局，不代表项目真实所在地。',
        earthCredit: 'NASA Blue Marble / Black Marble · 全球卫星影像，本地打包；城市级地形未加载 · 锚点不代表项目真实所在地',
        earthFallbackTitle: '地球视图暂不可用，已切换到项目地形图',
        earthWebglFailed: '这台设备或当前窗口没有可用的 WebGL。项目数据仍然可用，地形图保留全部入口。',
        earthTextureFailed: '本地地球影像未能载入。没有用低清贴图冒充 3D，已切换到项目地形图。',
        earthOpenHint: '单击降落并查看项目',
        earthMediaLoading: '正在扫描项目图片…',
        earthMediaFailed: '图片扫描失败，不能据此判断项目没有图片。',
        earthMediaNone: '扫描了 {roots} 个项目目录、{dirs} 个目录，暂时没有发现可用的图片。',
        earthMediaScanMeta: '扫描 {roots} 个目录 · {images} 张候选图',
        earthMediaChoose: '选择代表图',
        earthMediaChange: '更换',
        earthMediaClear: '取消固定',
        earthMediaPinned: '已固定为代表图',
        earthMediaPinnedMissing: '已固定的图片这次没有在项目目录中找到，仍保留记录。',
        earthMediaPickerTitle: '选择项目代表图',
        earthMediaPickerHint: '只列出项目目录和已关联文件夹里的真实图片；不会复制，也不会修改项目文件。',
        earthMediaManual: '手动关联相对路径',
        earthMediaManualPlaceholder: '例如 output/final/cover.png',
        earthMediaApply: '关联并固定',
        earthMediaCancel: '取消',
        earthMediaNoMatch: '没有匹配的图片',
        earthMediaRuntime: '运行时清单',
        earthMediaSource: '来源',
        earthAnchorOpen: '打开现场',
        earthAnchorCapability: 'AI 使用',
        earthAnchorOutputs: '产物',
        earthAnchorSessions: '会话',
        earthAnchorFolder: '目录',
        earthAnchorKicker: 'PROJECT ANCHOR / 项目锚点',
        earthAnchorEdit: '设置地图位置',
        earthAnchorEditTitle: '设置项目位置',
        earthAnchorEditHint: '拖动或双指缩放地球，点「地图选点」后点击球面；也可以直接填写经纬度。保存前不会更改项目位置。',
        earthAnchorLatitude: '纬度（-90 到 90）',
        earthAnchorLongitude: '经度（-180 到 180）',
        earthAnchorPick: '地图选点',
        earthAnchorPicking: '请点击地球表面选择位置',
        earthAnchorPickMiss: '请点击地球表面，空白区域没有坐标。',
        earthAnchorSave: '保存位置',
        earthAnchorReset: '恢复自动位置',
        earthAnchorInvalid: '请输入有效的纬度（-90 到 90）和经度（-180 到 180）。',
        earthAnchorSaved: '位置已保存',
        earthAnchorSaveFailed: '位置保存失败',
        earthAnchorRefreshFailed: '位置已保存，但显示刷新失败。请重试刷新。',
        earthAnchorRetryRefresh: '重试刷新',
        earthAnchorCancel: '取消',
        earthAnchorPreview: '预览位置',
        earthRecentRecord: '最近记录',
        earthNoRecord: '还没有可显示的记录',
        earthRecordHint: '活动时间来自本机扫描，不代表任务成功。',
        earthSceneSwitch: '场景',
        sceneDockNote: '固定导航',
        sceneSettings: '场景设置',
        sceneSettingsHint: '调整导航顺序、显示和启动场景。设置只保存在此设备。',
        sceneSettingsStart: '启动场景',
        sceneSettingsShow: '显示 {name}',
        sceneSettingsUp: '{name} 上移',
        sceneSettingsDown: '{name} 下移',
        sceneSettingsReset: '恢复默认',
        sceneSettingsStorageError: '无法保存到本地存储；设置仅在本次使用中有效。',
        sceneEarth: '地球',
        sceneStudio: '工作室',
        sceneLibrary: '图书馆',
        sceneTime: '时间庭',
        sceneShowDetails: '展开项目详情',
        sceneHideDetails: '收起项目详情',
        sceneProjectIndex: '项目目录',
        sceneStudioKicker: 'STUDIO / 项目工位',
        sceneStudioTitle: '项目也有自己的工位',
        sceneStudioIntro: '按生命周期分房，按项目分桌。房间只是空间布局，不代表团队、负责人或运行状态。',
        sceneStudioSearch: '找工位或项目…',
        sceneStudioDrill: '进入工位区',
        sceneStudioBackPlan: '返回平面',
        sceneStudioLayoutNote: '房间按生命周期与项目数量排布，仅用于空间浏览，不代表团队、负责人或组织关系。',
        sceneStudioEvidence: '状态只来自项目状态文件、运行时清单与本机扫描；没有证据就显示未知。',
        sceneStudioUnknown: '未知',
        sceneStudioDeskCount: '工位',
        sceneStudioMobileRooms: '选择房间查看工位',
        sceneStudioMobilePan: '左右滑动查看房间与工位',
        sceneStudioRoomsCount: '房间',
        sceneStudioPersistent: '长期项目 · 独立间',
        sceneStudioIncubating: '孵化项目 · 工位区',
        sceneStudioTemporary: '临时项目 · 共享桌',
        sceneStudioUnclassified: '待归类 · 收件台',
        sceneStudioIndependent: '独立间',
        sceneStudioSelected: '当前工位',
        sceneStudioEnter: '从工位进入',
        sceneStudioOpen: '打开项目现场',
        sceneStudioOverview: '总览',
        sceneStudioNoMatch: '没有匹配的工位。',
        sceneStudioEmpty: '这一区还没有项目。',
        sceneStudioRoomHint: '先选工位，再从右侧进入；单击查看，双击也可以进入。',
        sceneStudioSelectHint: '从平面或工位区选一个项目，右侧会出现真实代表图、最近记录和入口。',
        sceneStudioCafe: '茶水间 · 环境动效',
        sceneStudioEntry: '入口 / 项目现场',
        sceneStudioAmbient: '环境动效与项目运行无关',
        sceneStudioSpatialNote: '空间与人物为示意；人物不等于真实成员。运行状态只认状态文件、运行时清单与本机扫描。',
        sceneStudioCorridor: '走廊 · 空间示意',
        sceneStudioPantry: '茶水间',
        sceneStudioFloor: '工区',
        sceneStudioWing: '翼楼',
        sceneStudioOpenWing: '进入翼楼',
        sceneStudioSchematic: '示意人物',
        sceneStudioZoom: '平面缩放',
        sceneStudioReset: '归位',
        sceneStudioRecent: '最近记录',
        sceneStudioNoRecord: '未记录',
        sceneStudioNoImage: '没有可显示的代表图；不会借用其它项目图片。',
        sceneStudioMediaLoading: '正在读取项目图片…',
        sceneStudioMediaFailed: '项目图片读取失败。',
        sceneStudioRooms: '工位区',
        sceneStudioMediaSource: '代表图',
        sceneStudioBackStudio: '回到工作室',
        sceneStudioOpenFolder: '打开目录',
        sceneStudioViewAll: '查看全部',
        sceneTimeKicker: 'CHRONICLE / 项目时间庭',
        sceneTimeTitle: '项目也有自己的年轮',
        sceneTimeIntro: '按本机最后一次活动排序。内圈是最近，外圈是更早；时间只说明扫描记录，不代表任务完成或正在运行。',
        sceneTimeSearch: '找项目或路径…',
        sceneTimeAll: '全部',
        sceneTimeToday: '今天',
        sceneTimeWeek: '本周',
        sceneTimeMonth: '本月',
        sceneTimeQuarter: '本季',
        sceneTimeYear: '今年',
        sceneTimeOlder: '更早',
        sceneTimeUnknown: '未知',
        sceneTimeCount: '{n} 个项目',
        sceneTimeIndex: '时间索引',
        sceneTimeIndexHint: '单击查看 · 双击进入',
        sceneTimeSelectHint: '从时间索引或年轮选一个项目；这里会显示真实时间、会话和入口。',
        sceneTimeInner: '内圈最近',
        sceneTimeOuter: '外圈更早',
        sceneTimeNow: '现在',
        sceneTimeEmpty: '没有匹配的项目。',
        sceneTimeEmptyUnknown: '这一层没有可定位的时间记录。',
        sceneTimePartialUnknown: '{n} 个项目没有可靠时间，只在索引中显示。',
        sceneTimeSelected: '当前时间切片',
        sceneTimeLast: '最后一次活动',
        sceneTimeCreated: '创建',
        sceneTimeSessions: '会话',
        sceneTimeArtifacts: '产出',
        sceneTimeSize: '占用',
        sceneTimeNoDate: '未记录时间',
        sceneTimeNoDateHint: '本机没有可靠的创建或活动时间，不推算。',
        sceneTimeLastSource: '时间来自本机文件与扫描记录；不代表任务成功、完成或正在运行。',
        sceneTimeEnter: '进入项目现场',
        sceneTimeOpenFolder: '打开目录',
        sceneTimeNoSession: '没有关联会话',
        sceneTimeRecentSession: '最近会话',
        sceneTimeNoRecord: '未记录',
        sceneTimeDaysAgo: '{n} 天前',
        sceneTimeWeeksAgo: '{n} 周前',
        sceneTimeMonthsAgo: '{n} 个月前',
        sceneTimeYearsAgo: '{n} 年前',
        sceneTimeMedia: '代表图',
        sceneTimeMediaEmpty: '没有可显示的代表图；不会借用其它项目图片。',
        sceneTimeMediaLoading: '正在读取项目图片…',
        sceneTimeMediaFailed: '项目图片读取失败。',
        sceneTimeBack: '回到时间庭',
        sceneTimeExit: '项目列表',
        sceneTimeRefresh: '刷新扫描',
        sceneTimeStatus: '状态',
        sceneTimeLifecycle: '生命周期',
        sceneLibraryKicker: 'LIBRARY / 项目藏书室',
        sceneLibraryTitle: '每个项目是一本书',
        sceneLibraryIntro: '同一批项目、同一份证据，只是换一种翻阅方式。书脊上是真实项目，打开后仍是原来的现场。',
        sceneShelfPersistent: '长期书柜',
        sceneShelfIncubating: '在研书柜',
        sceneShelfTemporary: '短期书架',
        sceneShelfUnclassified: '待归档',
        sceneReading: '正在翻阅',
        sceneOpenBook: '打开这本书',
        sceneNoBook: '从书架上选一本，或回到地球。',
        sceneBackEarth: '回到地球',
        sceneBackLibrary: '回到图书馆',
        sceneBackTime: '回到时间庭',
        sceneLibraryReadingRoom: '阅览室 · 开架书库',
        sceneLibraryCatalog: '索引卡 / CARD CATALOG',
        sceneLibraryDesk: '阅览台 / READING DESK',
        sceneLibraryCover: '代表封面',
        sceneLibraryArtifacts: '项产物',
        sceneLibraryCreated: '创建',
        sceneLibraryLast: '最近活动',
        sceneLibrarySessions: '会话条目',
        sceneLibraryNoSession: '未记录会话；不生成占位对话。',
        sceneLibraryNoBook: '没有可翻阅的书',
        sceneLibrarySelect: '点击书脊选择项目；双击或回车打开。',
        sceneLibrarySource: '封面与记录来自本机扫描；没有代表图时保持空态。',
        sceneLibrarySpatialNote: '书脊颜色按生命周期；空白处是环境陈设，不代表项目；空间与人物为示意。',
        sceneLibraryMediaLoading: '读取项目图片…',
        sceneLibraryMediaFailed: '项目图片读取失败。',
        sceneLibraryExit: '项目列表',
        sceneLibraryNoMatch: '没有匹配的书',
        sceneLibraryPreviousPage: '上一页',
        sceneLibraryNextPage: '下一页',
        sceneLibraryPage: '页',
        contractTitle: '任务契约',
        contractGoal: '目标',
        contractInput: '输入',
        contractOutput: '输出',
        contractConstraints: '约束',
        contractStatus: '状态',
        contractNotRecorded: '未记录',
        contractHint: '来自项目状态文件与运行时清单；空白表示没有声明，不代表没有发生。',
        contractFromState: '本机记录',
        sceneLibrarySearch: '搜索书架…',
        sceneLibraryEmpty: '这一层还没有书。',
        sceneLibraryHonest: '书架只呈现已扫描到的项目；没有封面时不伪造书封。',
        libraryScene: '图书馆',
        roomCapability: 'AI 使用',
        capKicker: 'CAPABILITY / 能力与交接',
        capTitle: '这个项目怎么用',
        capIntro: '只写能从项目里看到的东西；没声明的入口，不假装已经接通。',
        capHow: '使用方式',
        capBoundary: '边界与限制',
        capNoTool: '执行边界与可调用入口',
        capBoundaryText: 'Skill 只提供方法；真正执行靠项目自己的 CLI / API。工作台不运行 GPU、不改项目文件、不把“打开会话”当成任务成功。',
        capSubmit: '任务提交',
        capAcceptance: '质量验收',
        capNoAcceptance: '未记录；运行成功 ≠ 质量验收通过。',
        capNoAcceptanceShort: '未记录',
        capEvidence: '能力证据',
        capEvidenceSub: '四种状态分开显示：已发现 / 已验证 / 未验证 / 不可用。',
        capEvidenceFolders: '项目目录',
        capEvidenceSessions: '关联会话',
        capEvidenceSkills: '按路径发现的 Skill',
        capEvidenceOutputs: '产出文件',
        capEvidenceTool: '执行入口',
        capEvidenceQuality: '质量验收',
        capStateVerified: '已验证',
        capStateDiscovered: '已发现',
        capStateDeclared: '已声明，未验证',
        capStateUnavailable: '不可用',
        capDiscoveredHint: '按路径匹配发现，未证明已接入',
        capToolIndex: '仅索引与打开；没有 adapter / CLI。',
        capToolProject: '项目级接入；自述文件只读，执行仍靠项目工具。',
        capToolApp: '声明了应用入口；未验证 adapter 是否可用。',
        capToolUnknown: '接入类型未验证。',
        capOpenHandoff: '生成交接单',
        capSessionsTitle: '跨 AI 会话',
        capNoSessions: '还没有关联会话',
        capSkillsTitle: '路径归属的 Skill',
        capSkillsHint: '只列出位于项目目录内的 SKILL.md；外部技能若未声明，不算已接入。',
        capSkillsEmpty: '没有发现位于项目目录内的 Skill。外部 Skill 若未在项目声明，不算已接入。',
        capHandoff: '交接摘要',
        capNoHandoff: '还没有交接记录。可以先生成一份预览，确认后再交给目标 AI。',
        capNoHandoffStatus: '无记录',
      },      en: {
        nav: 'Workbench',
        title: 'Workbench',
        subtitle: 'One entry to local projects, skills, AI software and disks',
        refresh: 'Refresh',
        rescanning: 'Scanning…',
        rescan: 'Rescan',
        lastScan: 'Last scan',
        projects: 'Projects',
        projectLabel: 'Project',
        active: 'Active',
        paused: 'Paused',
        archived: 'Archived',
        unknown: 'Unknown',
        totalSize: 'Project size',
        software: 'AI software',
        library: 'Projects',
        disks: 'Disks',
        skills: 'Skills',
        skillKicker: 'SKILL ATLAS · LOCAL INVENTORY',
        skillTitle: 'My skill atlas',
        skillSub: '{total} SKILL.md files, {names} unique names, across {sources} agent roots. Projects stay projects; skills stay skills.',
        skillAuthored: 'Mine',
        skillInstalled: 'Installed',
        skillAll: 'All',
        skillRefresh: 'Rescan',
        skillScanning: 'Scanning local skills…',
        skillScannedAt: 'Scanned {t}',
        skillAuthoredTag: 'Authored',
        skillMatrix: 'Source × purpose',
        skillMatrixHint: 'Click a cell to filter; darker means more skills',
        skillLow: 'few',
        skillHigh: 'many',
        skillSource: 'Source',
        skillAllSources: 'All sources',
        skillAllCategories: 'All purposes',
        skillAllScopes: 'All scopes',
        skillScope: 'Scope',
        skillScopeUser: 'User',
        skillScopeProject: 'Project',
        skillScopeApp: 'App',
        skillScopeSystem: 'System',
        skillSortSource: 'By source',
        skillSortName: 'By name',
        skillSortRecent: 'Recently changed',
        skillSearch: 'Search name, description, path, tag…',
        skillIndex: 'Skill index',
        skillIndexHint: 'Select a row to read its SKILL.md; duplicates show every install location',
        skillNoMatch: 'No matching skills',
        skillNoMatchHint: 'Try another keyword, or switch the scope to All.',
        skillDetailEmpty: 'Select a skill',
        skillDetailEmptyHint: 'Pick a row on the left to read its description and folder.',
        skillLoading: 'Reading skill…',
        skillOpen: 'Open folder',
        skillCopy: 'Copy path',
        skillCopied: 'Path copied',
        skillPath: 'SKILL.md',
        skillUpdated: 'Changed',
        skillSize: 'Size',
        skillPreview: 'Instructions',
        skillNoContent: 'This SKILL.md has no body.',
        skillNoDescription: 'No description',
        skillDuplicateCount: '{n} copies',
        skillDuplicatesTitle: 'Also installed here',
        skillCategory: 'Purpose',
        searchProjects: 'Search projects, paths, notes…',
        allSources: 'All sources',
        sortRecent: 'Recent activity',
        sortSize: 'Size',
        sortName: 'Name',
        sortCreated: 'Created',
        showHidden: 'Show hidden',
        showNoise: 'Show cache items',
        followupPending: 'Pending',
        followupNew: 'New',
        followupFilter: 'Pending only',
        followupHint: 'Newly discovered projects wait here after a rescan. Add a plain-language note, then mark them handled.',
        followupBanner: '{n} new projects still need a look',
        followupBannerHint: 'Confirm you want to keep them, add a one-line note, then mark them handled.',
        followupView: 'Review',
        followupMark: 'Mark handled',
        followupNeedNote: 'Add a one-line note before marking handled',
        followupMarked: 'Marked as handled',
        followupDiscovered: 'Discovered {t}',
        followupFailed: 'Could not save follow-up state',
        followupNone: 'No pending projects match',
        followupScanHint: 'Last scan {t}; rescan if you created projects today.',
        runtimeArtifacts: 'Outputs',
        runtimePipeline: 'Pipeline',
        runtimeReady: 'Ready',
        runtimeRunning: 'Running',
        runtimeWaiting: 'Waiting',
        runtimeBlocked: 'Blocked',
        runtimeFailed: 'Failed',
        runtimeDone: 'Done',
        runtimeUnknown: 'Unknown',
        runtimeHeartbeat: 'Last heartbeat',
        runtimeStale: 'Status is stale',
        runtimeStagesDone: '{done}/{total} stages',
        cards: 'Cards',
        table: 'Table',
        boardView: 'Terrain',
        boardAttnPending: 'To review',
        lifecyclePersistent: 'Long-term',
        lifecycleIncubating: 'Incubating',
        lifecycleTemporary: 'Temporary work',
        lifecycleUnclassified: 'Unclassified',
        lifecycleManual: 'Confirmed by you',
        lifecycleManifest: 'From project manifest',
        lifecycleHandoff: 'From handoff',
        lifecycleInferred: 'Workbench inference',
        wallLifecycleProjects: 'Projects',
        wallBandPersistent: 'Long-term projects',
        wallBandPersistentSub: 'Confirmed, continuing work with a clear intent.',
        wallBandIncubating: 'Incubating candidates',
        wallBandIncubatingSub: 'Code or session traces exist, but long-term intent is not confirmed; not treated as the main line yet.',
        wallLifecycleTemporary: 'Temporary',
        wallLifecycleUnclassified: 'Inbox',
        wallLifecycleAll: 'All',
        wallLifecycleSummary: '{p} long-term · {i} incubating · {t} temporary · {u} inbox',
        wallNoPersistent: 'No confirmed long-term projects yet',
        wallNoPersistentSub: 'Open something from Inbox and choose “Long-term project”. Only confirmed intent and continuity reach the project wall.',
        wallTemporaryTitle: 'Temporary work',
        wallTemporarySub: 'One-off images, charts, exports and experiments. Kept off the project wall, but never deleted.',
        wallTemporaryEmpty: 'No temporary work',
        wallTemporaryExpires: 'Cleanup suggestion in {t}',
        wallTemporaryExpired: 'Cleanup suggestion is due',
        wallTemporaryCleanup: 'Cleanup suggestion',
        wallUnclassifiedTitle: 'Inbox',
        wallUnclassifiedSub: 'Look first, then decide whether it becomes a project or temporary work.',
        wallUnclassifiedHint: 'Open the room and classify it in Settings',
        roomLifecycle: 'Project lifecycle',
        roomLifecycleSub: 'A folder is not a long-term project. Confirm intent before treating it as one.',
        roomLifecycleSave: 'Save classification',
        roomLifecycleSaved: 'Classification saved in the workbench',
        roomLifecycleFailed: 'Could not save classification',
        identityTitle: 'Project identity',
        identitySub: 'Stored only in the workbench; project files are never modified.',
        identityIntent: 'Why this is long-term',
        identityIntentPlaceholder: 'e.g. a screenwriting studio that keeps evolving, not a one-off generation task.',
        identityManifest: 'Project manifest (read-only)',
        identityNoManifest: 'No manifest; the workbench only reads it and never creates one.',
        integrationTitle: 'Project integration',
        integrationSub: 'The declaration lives in the project’s own workbench.project.json; it tells the workbench which layer it can act on.',
        integrationIndex: 'Index and open only',
        integrationIndexSub: 'No integration declaration yet. The workbench can inspect, record and open this folder, but cannot change the app.',
        integrationProject: 'Project-level integration',
        integrationProjectSub: 'Reads project-owned notes as read-only context; the workbench never rewrites project files.',
        integrationApp: 'App-level integration',
        integrationAppSub: 'The project declares an app entry. Operations reach the app only when the project implements an adapter or CLI.',
        integrationUnknown: 'Declared, unverified',
        integrationUnknownSub: 'The workbench does not recognize this integration type and will not pretend it can control the app.',
        integrationEntry: 'Entry',
        integrationState: 'State file',
        integrationApply: 'Applied through',
        integrationAgent: 'Agent',
        integrationManifest: 'Manifest',
        integrationNoEntry: 'No entry declared',
        integrationNoAdapter: 'A declaration is not a connection: without a callable adapter, the workbench still only indexes and opens this project.',
        integrationKind: 'Kind',
        integrationChipIndex: 'Index only',
        integrationChipProject: 'Project-level',
        integrationChipApp: 'App-level',
        integrationChipUnknown: 'Unverified',
        lineageTitle: 'Session lineage',
        lineageSub: 'A folder can hold many conversations. Only a confirmed main line and its continuations belong to the project.',
        lineageMain: 'Project main line',
        lineageCandidate: 'Suggested main (unconfirmed)',
        lineageContinuation: 'Continuation',
        lineageSide: 'Side work',
        lineageUnassigned: 'Unassigned',
        lineageSetMain: 'Set as main',
        lineageMarkContinuation: 'Mark continuation',
        lineageMarkSide: 'Move to side',
        lineageRootConfirmed: 'Main line confirmed',
        lineageRootCandidate: 'Candidate not confirmed',
        lineageBrokenParent: 'Parent session is outside this project',
        lineageUnassignedHint: 'These conversations only share the folder; they are not treated as the project main line.',
        lineageNoSessions: 'No sessions yet',
        sessionLineageSaved: 'Session main line saved locally in the workbench',
        sessionLineageFailed: 'Could not save session lineage',
        wsBack: 'Projects',
        wsOutputs: 'Outputs',
        wsSessions: 'Sessions',
        wsSettings: 'Settings',
        wsContinueTitle: 'Continue the latest work',
        wsContinueSub: 'Pick up “{title}” · {t}',
        wsStartTitle: 'Start a task from zero',
        wsStartSub: 'Give DSH a goal; it reads the project context first.',
        wsContinue: 'Continue',
        wsStart: 'Start',
        wsNewTask: 'New task',
        wsRuntime: 'Runtime',
        wsRuntimeSub: 'Read from the project’s own runtime file',
        wsNoRuntime: 'No runtime yet. Start a task and stages plus artifacts will appear here.',
        wsArtifactsCount: '{n} artifacts',
        wsLatestOutputs: 'Latest outputs',
        wsViewAllOutputs: 'All outputs',
        wsAllSessions: 'All sessions',
        wsRelations: 'Relations',
        wsUnsaved: 'Unsaved changes',
        wsOutputsSub: '{n} files, newest first',
        wsNoOutputs: 'No outputs yet',
        wsNoOutputsSub: 'Run a task or write files; outputs will show up here automatically.',
        wsSessionsSub: '{n} linked sessions',
        wsNoSessionsSub: 'Start from the task box, or link an existing DSH / Codex session.',
        wsSettingsSub: 'Status, tags, folders and project metadata',
        wsTaskEyebrow: 'Hand me a task',
        wsTaskStarter: 'First read the project status, README/AGENTS, and handoff notes; check progress, blockers, and the next step. Do not modify files or start GPU / ComfyUI yet. Give me a minimal executable plan and wait for my confirmation.',
        wsLeaveConfirm: 'This project has unsaved changes. Save and leave? Cancel stays on this page.',
        wsDiscardTaskConfirm: 'The task draft has not been sent and will be lost. Discard it and leave?',
        wsChangedDuringSave: 'Changes were made while saving. Review them before leaving.',
        wsTaskPlaceholder: 'Add a concrete task, or send this opening as-is…',
        wsRun: 'Send to DSH',
        wsComposeHint: 'Ctrl / ⌘ + Enter · safe opening prefilled; add a task if needed',
        wallEmptySub: 'Sorted by recent activity; the table view has the full list',
        wallViewAll: 'View all {n} projects',
        wallEmpty: 'No project data yet',
        empty: 'No matching projects',
        openFolder: 'Open folder',
        copyPath: 'Copy path',
        details: 'Details',
        created: 'Created',
        lastActivity: 'Last activity',
        size: 'Size',
        files: 'Files',
        sourcesLabel: 'Sources',
        toolsLabel: 'Tools',
        git: 'Git',
        gitDirty: '{n} uncommitted',
        branch: 'Branch',
        remote: 'Remote',
        commits: 'Commits',
        sessions: 'Sessions',
        save: 'Save',
        saving: 'Saving…',
        saved: 'Saved',
        cancel: 'Cancel',
        close: 'Close',
        status: 'Status',
        tags: 'Tags',
        pin: 'Pin',
        pinned: 'Pinned',
        hide: 'Hide from list',
        dataDir: 'Data directory',
        free: 'Free',
        cleanupHint: 'Archived projects that can be cleaned up, by size; select in the Library and confirm each item.',
        installed: 'Installed',
        recent: 'Recent',
        categoryAll: 'All categories',
        noData: 'No inventory generated yet',
        scanNow: 'Start scan',
        scanHint: 'Reads project markers, Git metadata, OpenCode and DSH sessions. It never modifies files.',
        noRootsHint: 'No project roots configured. Set roots in ~/.dsh/data/dsh-workbench/config.json, then scan again.',
        daysAgo: '{n} days ago',
        monthsAgo: '{n} months ago',
        today: 'Today',
        yesterday: 'Yesterday',
        ungrouped: 'Ungrouped',
        path: 'Path',
        unknownVersion: 'No version recorded',
        noSummary: 'No auto summary',
        workspaceUsage: 'By workspace',
        cleanupCandidates: 'Cleanup candidates',
        goCleanup: 'Clean up',
        notDeleted: 'Item-by-item confirmation',
        notePlaceholder: 'What is this project? Why did it stop, or what comes next?',
        saveHint: 'Ctrl / Cmd + Enter to save',
        projectNotes: 'Workbench note',
        libraryHint: 'A project can link several folders; workspace roots are never shown as projects.',
        scanTook: 'Took',
        generated: 'Generated',
        warnings: 'Warnings',
        savedToast: 'Note saved',
        scanStarted: 'Scan started; you can keep browsing',
        scanFailed: 'Scan failed',
        apiError: 'Cannot reach the workbench service',
        retry: 'Retry',
        resetFilters: 'Reset filters',
        showing: 'Showing',
        of: '/',
        parentProject: 'Parent',
        addTags: 'Comma-separated tags',
        diskNote: 'Capacity in GiB; project volume is a scan estimate.',
        archiveNote: 'Deleting archives/backups requires item-by-item confirmation.',
        select: 'Select',
        selectExit: 'Exit selection',
        selectHint: 'Only archived projects can be selected; each item still needs confirmation.',
        selectAllArchived: 'Select archived',
        clearSelection: 'Clear selection',
        deleteNoSelection: 'Select archived projects first.',
        deleteMax: 'A batch can contain at most 50 items; process in smaller batches.',
        selectedSummary: '{n} selected · {size}',
        selectPrompt: 'Select one or more archived projects',
        batchRecycle: 'Move to Recycle Bin',
        batchHint: 'Only archived projects are selectable; nothing is deleted until every item is checked.',
        deleteTitle: 'Process archived projects',
        deleteSubtitle: 'These directories will leave their current location. Check every item.',
        deleteRecycle: 'Move to Windows Recycle Bin',
        deleteRecycleHint: 'Recoverable; disk space is freed only after emptying the bin.',
        deletePermanent: 'Delete permanently',
        deletePermanentHint: 'Cannot be undone; frees space immediately.',
        deleteCheckAll: 'Check all',
        deleteCheckedAll: 'All checked',
        deleteItemConfirm: 'Checked',
        deletePermanentAck: 'I understand permanent deletion cannot be recovered from the Recycle Bin.',
        deleteConfirmRecycle: 'Move {n} items to Recycle Bin',
        deleteConfirmPermanent: 'Delete {n} items permanently',
        deleteBusy: 'Working…',
        deleteSafeHint: 'Top-level archived directories only; links and protected paths are refused.',
        deleteDoneRecycle: 'Moved to Recycle Bin: {n}',
        deleteDonePermanent: 'Permanently deleted: {n}',
        deletePartial: '{ok} succeeded, {fail} failed',
        deleteFailed: 'Delete failed',
        deleteHostMissing: 'The delete endpoint is not loaded yet. Restart the desktop app and try again.',
        deleteAuditHint: 'Audit log: workbench data directory / deletions.log',
        selectArchivedOnly: 'Only archived projects can be selected',
        protected: 'Protected',
        onlyArchived: 'Only archived',
        items: 'items',
        statusSource: 'Status source',
        sourceAuto: 'Detected automatically',
        sourceManifest: 'Project manifest',
        sourceRuntime: 'Runtime state',
        sourceManual: 'Marked manually',
        sourceConvention: 'Project convention',
        sourceOther: '{value}',
        sourceUnknown: 'Unknown',
        projectCountLabel: 'Projects',
        softwareCountLabel: 'Software',
        detailsFor: 'Project details',
        opencode: 'OpenCode',
        codes: 'Local Codes',
        dsh: 'DSH',
        lastCommit: 'Last commit',
        childCount: 'Subprojects',
        copied: 'Copied',
        topProjects: 'Largest projects',
        workspaceCount: 'Workspaces',
        noSoftware: 'No matching software',
        searchSoftware: 'Search software…',
        allStatus: 'All statuses',
        noteSavedLocally: 'Notes stay in the workbench and are never written into the project.',
        openFailed: 'Could not open',
        saveFailed: 'Could not save',
        ready: 'Ready',
        agentUntitled: 'Untitled session',
        agentOpenSession: 'Open and continue',
        agentOpenSessionFailed: 'Could not open session: this DSH has no uiWorkspace.openSession.',
        agentOpened: 'Session opened; continue in the conversation.',
        projectFolders: 'Project folders',
        addFolder: 'Link folder',
        folderPathPlaceholder: 'Absolute path to an existing folder',
        folderRoleReference: 'Reference',
        folderRoleCode: 'Code',
        folderRoleAssets: 'Assets',
        folderRoleOutput: 'Output',
        folderRoleData: 'Data',
        folderRoleDocs: 'Docs',
        folderAdded: 'Folder linked',
        folderAddFailed: 'Could not link folder',
        folderRemoved: 'Folder unlinked',
        remove: 'Remove',
        recentSessions: 'Recent sessions',
        noSessions: 'No DSH session for this project yet',
        sessionCountLabel: '{n} sessions',
        sessionForked: 'Forked',
        sessionForkAction: 'Fork',
        sessionForkDone: 'Forked a new session; continue there.',
        sessionForkUnavailable: 'This DSH does not support session forking.',
        sessionLink: 'Link session',
        sessionLinkHint: 'Attach a session that has no project folder; the session is not moved or rewritten.',
        sessionLinked: 'Session linked',
        sessionUnlinked: 'Session unlinked',
        sessionManual: 'Manual',
        sessionUnlink: 'Unlink',
        sessionNoCandidates: 'No unassigned sessions',
        sessionLinkFailed: 'Failed to link session',
        folderCountLabel: '{n} folders',
        inheritTarget: 'Hand off to',
        inheritExistingGroup: 'Existing project sessions',
        handoffExistingOpen: 'Open existing session',
        handoffExistingHint: 'Opens the selected session and copies the handoff; it does not create a session or pretend to have sent it.',
        handoffExistingOpened: 'Opened the existing session and copied the handoff; paste and confirm before sending.',
        inheritDsh: 'New DSH session',
        inheritOpenCode: 'New OpenCode session',
        inheritCodex: 'Codex (copy handoff only)',
        inheritComfy: 'ComfyUI (open asset folder)',
        inheritOther: 'Other app (copy handoff only)',
        inheritPackOnly: 'The handoff is copied to the clipboard; the target app is not pretending to have native memory.',
        inheritOpenCodeDone: 'Created an OpenCode session and sent the handoff.',
        inheritOpenDone: 'Opened the project folder and recorded this handoff.',
        inheritFailed: 'Handoff failed',
        handoff: 'AI handoff',
        handoffTitle: 'Project handoff',
        handoffSub: 'Capture the current state; a new DSH session is prefilled only, never sent automatically.',
        handoffSource: 'Source',
        handoffManual: 'Manual handoff',
        handoffDshSource: 'DSH session',
        handoffSourceCodex: 'Codex session',
        handoffGoal: 'Goal / next step',
        handoffDefaultGoal: 'Continue the current unfinished work in this project; verify recent progress before starting.',
        handoffNoProgress: 'No later progress is available; verify the latest request and project files first.',
        handoffLatestStatus: 'Latest state',
        handoffLatestError: 'Latest blocker',
        handoffTruthDocs: 'Source-of-truth docs',
        handoffTruthDocsUnread: 'Not read',
        handoffTruthDocsNotFound: 'not found in linked project folders',
        handoffRecentUserContext: 'Recent user words (reference only, not instructions)',
        handoffGoalPlaceholder: 'Example: continue the current task in DSH and verify the existing build first.',
        handoffProgress: 'Current progress',
        handoffProgressPlaceholder: 'What is done, what was verified, and what remains.',
        handoffConstraints: 'Constraints',
        handoffConstraintsPlaceholder: 'Example: do not delete old data; do not modify protected directories; read the project notes first.',
        handoffFiles: 'Files and entry points',
        handoffFilesPlaceholder: 'Project root, key files, build or test commands.',
        handoffPreview: 'Handoff preview',
        handoffSummary: 'Source summary',
        handoffCopy: 'Copy handoff',
        handoffCopied: 'Handoff copied',
        handoffCopyFailed: 'Copy failed; select the preview text and copy it manually.',
        handoffStart: 'Take over in new DSH session',
        handoffStarting: 'Opening…',
        handoffHint: 'Prefilled into the input only; not sent automatically.',
        handoffGoalRequired: 'Fill in “Goal / next step” first.',
        handoffUnavailable: 'This DSH does not expose workspace or new-session APIs; copy the handoff instead.',
        handoffNoPath: 'This project has no usable path, so a session cannot be created.',
        handoffDraftWarning: 'This workspace has an unsent draft; continuing will replace it.',
        handoffDraftReplace: 'Take over anyway',
        handoffSourceLoading: 'Reading the latest session…',
        handoffSourceFailed: 'Could not read the latest session digest; fill it in manually.',
        handoffForkFailed: 'Could not fork the session',
        handoffNoProject: 'No matching project',
        handoffProject: 'Project',
        handoffPath: 'Path',
        handoffGeneratedAt: 'Generated at',
        handoffSourceSession: 'Source session',
        handoffPromptTitle: 'Project handoff',
        handoffRulesLabel: 'Handoff rules',
        handoffRules: '- Read the project’s existing README, AGENTS.md or docs when present, then restate your understanding of the current state, next step, and risks before acting.\n- Do not redo work that is already complete and verified.\n- Read the project files directly when needed; ask me if information conflicts.\n- Do not delete, overwrite, or migrate any data unless I explicitly confirm it.\n- Unless I check “save into project” on this handoff, the workbench does not modify project files; after meaningful changes, tell me the changed files, verification and next step.',
        handoffUnknown: '(not provided)',
        handoffOpened: 'Handoff prefilled in a new DSH session; review it before sending.',
        handoffPersist: 'Optional: save the handoff into the project (off by default)',
        handoffPersistHint: 'By default the handoff stays in the workbench and is prefilled into a new session. Checking this writes .dsh/handoff; checking the next box also maintains AGENTS.md. This is an explicit deep integration.',
        handoffPersistAgents: 'Maintain the AGENTS.md pointer',
        handoffPersistFailed: 'Could not write the handoff into the project',
        handoffPersistNoProject: 'No project matches this handoff',
        handoffHistory: 'Handoff history',
        handoffHistorySub: 'Prefill is not delivery. Completed and failed are confirmed by you; execution success is never fabricated.',
        handoffHistoryEmpty: 'No handoff records yet.',
        sessionSourceUnavailable: '{{source}} session source unavailable: {{error}}',
        handoffStatusPrefilled: 'Prefilled',
        handoffStatusSent: 'Sent',
        handoffStatusRunning: 'Running',
        handoffStatusCompleted: 'Completed',
        handoffStatusFailed: 'Failed',
        handoffMarkDone: 'Mark completed',
        handoffMarkFailed: 'Mark failed',
        handoffRecordStatusFailed: 'Could not update handoff status',
        handoffReadBoundary: 'Read boundary',
        wallKicker: 'LOCAL AI WORKBENCH',
        wallTitleA: 'Project',
        wallTitleB: 'terrain',
        terrainKicker: 'PROJECT TERRAIN · RECENCY × LIFECYCLE',
        terrainSub: 'Each dot is a project. Right is more recent, down is a lighter lifecycle; larger dots take more disk.',
        terrainOld: 'older',
        terrainNow: 'today',
        terrainRecent: 'Last activity',
        terrainBandPersistent: 'Long-term',
        terrainBandIncubating: 'Incubating',
        terrainBandTemporary: 'Temporary',
        terrainBandUnclassified: 'Inbox',
        terrainHint: 'Click to focus · double-click to enter · arrow keys to move',
        terrainFocus: 'Focused',
        terrainEnter: 'Enter project',
        terrainCount: '{n} projects',
        terrainRunning: 'Running',
        terrainEmptyBand: 'No projects in this band yet',
        terrainSize: 'Disk',
        wallSub: '{total} projects, {active} in motion, {pending} waiting for review.',
        wallNoArtifact: 'No output yet',
        wallAll: 'All projects',
        wallRecent: 'Recently updated',
        deckSignal: 'Project signal',
        deckSignalHint: 'Each bar is a project, ordered by recent activity',
        deckQueue: 'Project queue',
        deckQueueHint: 'Click to preview · double-click to enter · ↑↓ to move',
        deckStage: 'In focus',
        deckEnter: 'Enter project',
        deckOpenFolder: 'Open folder',
        deckAxisOld: '30 days ago',
        deckAxisNow: 'Today',
        deckStageHint: 'The stage is a preview; work inside the project room.',
        deckNoActive: 'No project to show',
        deckRecent: 'Last activity',
        deckSessionCount: '{n} sessions',
        deckSessions: 'Sessions',
        deckOutputs: 'Outputs',
        roomKicker: 'PROJECT SCENE',
        roomBrief: 'Brief',
        roomEvidence: 'Evidence',
        roomSetup: 'Setup',
        roomNext: 'Next move',
        roomComposeOpen: 'Hand DSH a new task',
        roomComposeClose: 'Hide task composer',
        roomLatest: 'Latest output',
        roomMemory: 'Handoff record (read-only)',
        roomMemoryNative: 'Ready',
        roomMemoryEmpty: 'Not created',
        roomMemoryHint: 'The workbench stores handoff records only. It never writes, overwrites or creates files in the project.',
        roomMemoryOpen: 'View record',
        noteStateLabel: 'Workbench note',
        noteStateYes: 'Written',
        noteStateNo: 'Not written',
        roomNoCover: 'No visual output yet',
        earthTitle: 'Project Earth',
        earthSubtitle: 'A navigation map for this machine',
        earthOverline: 'EARTH / LOCAL PROJECTS',
        earthHeadline: 'Put your projects back on a planet',
        earthIntro: 'Real satellite imagery with day and night from this device’s clock. Project anchors are for your layout, not the projects’ real-world locations.',
        earthPlayHint: 'Pause or resume rotation',
        earthIndex: 'Project index',
        earthIndexFullscreen: 'Fullscreen index',
        earthIndexEnter: 'View landing',
        earthFocusHint: 'Double-click empty space for fullscreen',
        earthFocusExitHint: 'Fullscreen · double-click empty space to exit',
        earthPanorama: 'Fullscreen',
        earthExitPanorama: 'Exit fullscreen · Esc',
        earthSearch: 'Search projects, paths, notes…',
        earthNoMatch: 'No matching project',
        earthProjectOverline: 'PROJECT / SELECTED',
        earthNoNote: 'No workbench note yet. Open the project scene to add one.',
        earthEnter: 'Descend to landing',
        earthOpenRoom: 'Open project directly',
        earthLandingKicker: 'LANDING / PROJECT DETAIL',
        earthLandingLabel: 'Landed on the map',
        earthLandingHint: 'The camera is holding at the marker. Inspect the real representative image, recent record and entries before choosing to enter the project scene.',
        earthLandingWheelHint: 'Scroll on the globe · back to orbit',
        roomWheelBack: 'Wheel up · back to detail',
        roomWheelBackEarth: 'Wheel up · back to Earth',
        roomWheelBackTitle: 'Wheel up or Esc to go back',
        roomBackDetail: 'Back to detail',
        earthLandingEnter: 'Enter project scene',
        earthLandingReturn: 'Back to orbit',
        earthSelectHint: 'Click a marker, or use the Project index button above to open the list. A marker click lands for details first; double-click empty space for fullscreen.',
        earthTouchSelectHint: 'Tap a marker or the project index to view a project; tap Fullscreen to expand the view.',
        earthTouchHint: 'Drag to rotate · pinch to zoom',
        earthTouchExitPanorama: 'Exit fullscreen',
        earthZoomIn: 'Zoom in',
        earthZoomOut: 'Zoom out',
        earthDayNight: 'Day and night follow device time',
        earthTerrainAssist: 'Night terrain brightened for inspection',
        earthDragHint: 'Drag to rotate · wheel to zoom · space to pause',
        earthFlying: 'Descending to “{name}”',
        earthTouchdownKicker: 'TOUCHDOWN / LANDED',
        earthTouchdownEnter: 'Entering “{name}”',
        earthTouchdownHint: 'The camera has settled on the marker. Opening the project scene.',
        earthArrivedOverline: 'SURFACE / PROJECT SCENE',
        earthSiteTop: 'Satellite imagery · schematic site',
        earthArrivalDossier: 'SITE DOSSIER / PROJECT NOTES',
        earthArrivedHint: 'The camera has landed on this project marker. Enter the scene for capability, sessions, outputs and handoff boundaries.',
        earthOpenScene: 'Enter project scene',
        earthBackToOrbit: 'Back to orbit',
        earthCanvasLabel: 'Interactive satellite Earth, draggable and zoomable',
        earthLayoutNote: 'Anchors are for project layout and do not represent the projects’ real-world locations.',
        earthCredit: 'NASA Blue Marble / Black Marble · global imagery bundled locally; city-level terrain is not loaded · anchors do not represent real project locations',
        earthFallbackTitle: 'Earth view is unavailable; switched to the project terrain',
        earthWebglFailed: 'WebGL is unavailable in this device or window. Project data still works and the terrain view keeps every entry point.',
        earthTextureFailed: 'The local Earth imagery could not be loaded. No low-resolution texture was passed off as 3D; the terrain view is shown instead.',
        earthOpenHint: 'Click to descend and inspect the project',
        earthMediaLoading: 'Scanning project images…',
        earthMediaFailed: 'Image scan failed. This does not prove the project has no images.',
        earthMediaNone: 'Scanned {roots} project roots and {dirs} folders; no usable images found yet.',
        earthMediaScanMeta: 'Scanned {roots} roots · {images} candidates',
        earthMediaChoose: 'Choose representative image',
        earthMediaChange: 'Change',
        earthMediaClear: 'Unpin',
        earthMediaPinned: 'Pinned as representative',
        earthMediaPinnedMissing: 'The pinned image was not found in this scan; the record is kept.',
        earthMediaPickerTitle: 'Choose a project image',
        earthMediaPickerHint: 'Only real images inside the project and its linked folders. Nothing is copied or written into the project.',
        earthMediaManual: 'Link a relative path',
        earthMediaManualPlaceholder: 'e.g. output/final/cover.png',
        earthMediaApply: 'Link and pin',
        earthMediaCancel: 'Cancel',
        earthMediaNoMatch: 'No matching image',
        earthMediaRuntime: 'Runtime manifest',
        earthMediaSource: 'Source',
        earthAnchorOpen: 'Open scene',
        earthAnchorCapability: 'AI usage',
        earthAnchorOutputs: 'Outputs',
        earthAnchorSessions: 'Sessions',
        earthAnchorFolder: 'Folder',
        earthAnchorKicker: 'PROJECT ANCHOR / PROJECT NOTES',
        earthAnchorEdit: 'Set map location',
        earthAnchorEditTitle: 'Set project location',
        earthAnchorEditHint: 'Drag or pinch the globe, then choose a point on its surface; or enter latitude and longitude. Changes are applied only after saving.',
        earthAnchorLatitude: 'Latitude (-90 to 90)',
        earthAnchorLongitude: 'Longitude (-180 to 180)',
        earthAnchorPick: 'Pick on map',
        earthAnchorPicking: 'Select a point on the globe',
        earthAnchorPickMiss: 'Select the globe surface; empty space has no coordinates.',
        earthAnchorSave: 'Save location',
        earthAnchorReset: 'Use automatic location',
        earthAnchorInvalid: 'Enter a latitude from -90 to 90 and longitude from -180 to 180.',
        earthAnchorSaved: 'Location saved',
        earthAnchorSaveFailed: 'Could not save location',
        earthAnchorRefreshFailed: 'Location saved, but the display could not refresh. Please retry.',
        earthAnchorRetryRefresh: 'Retry refresh',
        earthAnchorCancel: 'Cancel',
        earthAnchorPreview: 'Preview location',
        earthRecentRecord: 'Recent record',
        earthNoRecord: 'No record to show yet',
        earthRecordHint: 'Activity time comes from the local scan; it does not mean the task succeeded.',
        earthSceneSwitch: 'Scene',
        sceneDockNote: 'Pinned navigation',
        sceneSettings: 'Scene settings',
        sceneSettingsHint: 'Choose scene order, visibility and startup scene. Stored on this device.',
        sceneSettingsStart: 'Startup scene',
        sceneSettingsShow: 'Show {name}',
        sceneSettingsUp: 'Move {name} up',
        sceneSettingsDown: 'Move {name} down',
        sceneSettingsReset: 'Restore defaults',
        sceneSettingsStorageError: 'Local storage is unavailable; settings last only for this session.',
        sceneEarth: 'Earth',
        sceneStudio: 'Studio',
        sceneLibrary: 'Library',
        sceneTime: 'Time court',
        sceneShowDetails: 'Show project details',
        sceneHideDetails: 'Hide project details',
        sceneProjectIndex: 'Project index',
        sceneStudioKicker: 'STUDIO / PROJECT WORKSTATIONS',
        sceneStudioTitle: 'Every project has a desk',
        sceneStudioIntro: 'Rooms follow lifecycle, desks follow projects. The floor is a spatial layout, not a team, owner, or runtime claim.',
        sceneStudioSearch: 'Find a desk or project…',
        sceneStudioDrill: 'Enter work area',
        sceneStudioBackPlan: 'Back to floor',
        sceneStudioLayoutNote: 'Rooms are arranged by lifecycle and project count for spatial browsing only; they do not imply a team, owner, or reporting line.',
        sceneStudioEvidence: 'Status comes only from state files, runtime manifests, and the local scan. Without evidence it stays unknown.',
        sceneStudioUnknown: 'Unknown',
        sceneStudioDeskCount: 'desks',
        sceneStudioMobileRooms: 'Choose a room to view its desks',
        sceneStudioMobilePan: 'Swipe left or right to explore the room and desks',
        sceneStudioRoomsCount: 'rooms',
        sceneStudioPersistent: 'Long-term · private rooms',
        sceneStudioIncubating: 'Incubating · work areas',
        sceneStudioTemporary: 'Temporary · shared desks',
        sceneStudioUnclassified: 'Unsorted · intake',
        sceneStudioIndependent: 'Private room',
        sceneStudioSelected: 'Current desk',
        sceneStudioEnter: 'Enter from this desk',
        sceneStudioOpen: 'Open project scene',
        sceneStudioOverview: 'Overview',
        sceneStudioNoMatch: 'No matching desk.',
        sceneStudioEmpty: 'No projects in this area yet.',
        sceneStudioRoomHint: 'Choose a desk, then enter from the right. Click to inspect; double-click also enters.',
        sceneStudioSelectHint: 'Choose a project from the floor or a work area; real media, recent record, and entry points appear here.',
        sceneStudioCafe: 'Pantry · ambient motion',
        sceneStudioEntry: 'Entrance / project scene',
        sceneStudioAmbient: 'Ambient motion is unrelated to project runtime',
        sceneStudioSpatialNote: 'Space and figures are schematic; a figure is not a real team member. Runtime is evidence-only: state file, runtime manifest, local scan.',
        sceneStudioCorridor: 'Corridor · schematic space',
        sceneStudioPantry: 'Pantry',
        sceneStudioFloor: 'Work area',
        sceneStudioWing: 'Wing',
        sceneStudioOpenWing: 'Enter wing',
        sceneStudioSchematic: 'Schematic figure',
        sceneStudioZoom: 'Floor zoom',
        sceneStudioReset: 'Reset',
        sceneStudioRecent: 'Recent record',
        sceneStudioNoRecord: 'Not recorded',
        sceneStudioNoImage: 'No representative image to show; another project’s image is never borrowed.',
        sceneStudioMediaLoading: 'Reading project images…',
        sceneStudioMediaFailed: 'Project image read failed.',
        sceneStudioRooms: 'Work areas',
        sceneStudioMediaSource: 'Representative image',
        sceneStudioBackStudio: 'Back to the studio',
        sceneStudioOpenFolder: 'Open folder',
        sceneStudioViewAll: 'View all',
        sceneTimeKicker: 'CHRONICLE / TIME COURT',
        sceneTimeTitle: 'Every project leaves a ring',
        sceneTimeIntro: 'Ordered by the last local activity. The inner coil is recent, the outer coil older; time is scan evidence, not a claim that work finished or is running.',
        sceneTimeSearch: 'Find a project or path…',
        sceneTimeAll: 'All',
        sceneTimeToday: 'Today',
        sceneTimeWeek: 'This week',
        sceneTimeMonth: 'This month',
        sceneTimeQuarter: 'This quarter',
        sceneTimeYear: 'This year',
        sceneTimeOlder: 'Older',
        sceneTimeUnknown: 'Unknown',
        sceneTimeCount: '{n} projects',
        sceneTimeIndex: 'Time index',
        sceneTimeIndexHint: 'Click to inspect · double-click to enter',
        sceneTimeSelectHint: 'Choose a project from the index or the coil; real dates, sessions and entry points appear here.',
        sceneTimeInner: 'Inner coil: recent',
        sceneTimeOuter: 'Outer coil: older',
        sceneTimeNow: 'Now',
        sceneTimeEmpty: 'No matching projects.',
        sceneTimeEmptyUnknown: 'No locatable time records in this band.',
        sceneTimePartialUnknown: '{n} projects have no reliable time and appear only in the index.',
        sceneTimeSelected: 'Current time slice',
        sceneTimeLast: 'Last activity',
        sceneTimeCreated: 'Created',
        sceneTimeSessions: 'Sessions',
        sceneTimeArtifacts: 'Outputs',
        sceneTimeSize: 'Size',
        sceneTimeNoDate: 'Time not recorded',
        sceneTimeNoDateHint: 'No reliable created or activity time exists locally; nothing is inferred.',
        sceneTimeLastSource: 'Time comes from local files and scan records; it does not mean the task succeeded, finished, or is running.',
        sceneTimeEnter: 'Enter project',
        sceneTimeOpenFolder: 'Open folder',
        sceneTimeNoSession: 'No linked session',
        sceneTimeRecentSession: 'Latest session',
        sceneTimeNoRecord: 'Not recorded',
        sceneTimeDaysAgo: '{n}d ago',
        sceneTimeWeeksAgo: '{n}w ago',
        sceneTimeMonthsAgo: '{n}mo ago',
        sceneTimeYearsAgo: '{n}y ago',
        sceneTimeMedia: 'Representative image',
        sceneTimeMediaEmpty: 'No representative image found; no other project’s image is borrowed.',
        sceneTimeMediaLoading: 'Reading project images…',
        sceneTimeMediaFailed: 'Project image read failed.',
        sceneTimeBack: 'Back to the time court',
        sceneTimeExit: 'Project list',
        sceneTimeRefresh: 'Refresh scan',
        sceneTimeStatus: 'Status',
        sceneTimeLifecycle: 'Lifecycle',
        sceneLibraryKicker: 'LIBRARY / PROJECT READING ROOM',
        sceneLibraryTitle: 'Every project is a book',
        sceneLibraryIntro: 'The same projects and the same evidence, read a different way. Spines are real projects; opening one returns to the same scene.',
        sceneShelfPersistent: 'Long-term shelf',
        sceneShelfIncubating: 'Incubating shelf',
        sceneShelfTemporary: 'Temporary shelf',
        sceneShelfUnclassified: 'Unsorted',
        sceneReading: 'Now reading',
        sceneOpenBook: 'Open this book',
        sceneNoBook: 'Pick a book from a shelf, or return to Earth.',
        sceneBackEarth: 'Back to Earth',
        sceneBackLibrary: 'Back to the library',
        sceneBackTime: 'Back to the time garden',
        sceneLibraryReadingRoom: 'Reading room · open stacks',
        sceneLibraryCatalog: 'CARD CATALOG / INDEX',
        sceneLibraryDesk: 'READING DESK / SELECTED',
        sceneLibraryCover: 'Representative cover',
        sceneLibraryArtifacts: 'artifacts',
        sceneLibraryCreated: 'Created',
        sceneLibraryLast: 'Last activity',
        sceneLibrarySessions: 'Session entries',
        sceneLibraryNoSession: 'No recorded sessions; no placeholder dialogue is generated.',
        sceneLibraryNoBook: 'No book to read',
        sceneLibrarySelect: 'Click a spine to select; double-click or press Enter to open.',
        sceneLibrarySource: 'Covers and records come from local scans; an absent cover stays empty.',
        sceneLibrarySpatialNote: 'Spine color follows lifecycle; empty shelf space is scenery, not a project; space and figures are schematic.',
        sceneLibraryMediaLoading: 'Reading project image…',
        sceneLibraryMediaFailed: 'Project image read failed.',
        sceneLibraryExit: 'Project list',
        sceneLibraryNoMatch: 'No matching books',
        sceneLibraryPreviousPage: 'Previous page',
        sceneLibraryNextPage: 'Next page',
        sceneLibraryPage: 'Page',
        contractTitle: 'Task contract',
        contractGoal: 'Goal',
        contractInput: 'Input',
        contractOutput: 'Output',
        contractConstraints: 'Constraints',
        contractStatus: 'Status',
        contractNotRecorded: 'Not recorded',
        contractHint: 'From the project state file and runtime manifest; blank means undeclared, not that nothing happened.',
        sceneLibrarySearch: 'Search the shelves…',
        sceneLibraryEmpty: 'This shelf has no books yet.',
        sceneLibraryHonest: 'Shelves only show scanned projects; when there is no cover, no cover is invented.',
        libraryScene: 'Library',
        roomCapability: 'AI usage',
        capKicker: 'CAPABILITY / USE & HANDOFF',
        capTitle: 'How this project is used',
        capIntro: 'Only what the project actually shows. A declared entry point is not the same as a verified connection.',
        capHow: 'How to use it',
        capBoundary: 'Boundaries',
        capNoTool: 'Execution boundary and callable entry',
        capBoundaryText: 'A Skill is guidance; real execution belongs to the project’s own CLI or API. The workbench does not run GPU work, rewrite project files, or treat “opened a session” as task success.',
        capSubmit: 'Task submission',
        capAcceptance: 'Quality acceptance',
        capNoAcceptance: 'Not recorded; a successful run is not quality acceptance.',
        capNoAcceptanceShort: 'Not recorded',
        capEvidence: 'Capability evidence',
        capEvidenceSub: 'Four states stay separate: discovered, verified, unverified, unavailable.',
        capEvidenceFolders: 'Project folders',
        capEvidenceSessions: 'Linked sessions',
        capEvidenceSkills: 'Path-matched Skills',
        capEvidenceOutputs: 'Output files',
        capEvidenceTool: 'Execution entry',
        capEvidenceQuality: 'Quality acceptance',
        capStateVerified: 'Verified',
        capStateDiscovered: 'Discovered',
        capStateDeclared: 'Declared, unverified',
        capStateUnavailable: 'Unavailable',
        capDiscoveredHint: 'Discovered by path; not proof of connection',
        capToolIndex: 'Index and open only; no adapter or CLI.',
        capToolProject: 'Project-level integration; the manifest is read-only and execution stays with project tools.',
        capToolApp: 'An application entry is declared; the adapter has not been verified.',
        capToolUnknown: 'Integration type is unverified.',
        capOpenHandoff: 'Create handoff',
        capSessionsTitle: 'Cross-AI sessions',
        capNoSessions: 'No linked sessions yet',
        capSkillsTitle: 'Path-owned Skills',
        capSkillsHint: 'Only SKILL.md files inside project folders. External skills without a declaration are not counted as connected.',
        capSkillsEmpty: 'No Skill was found inside the project folders. External skills without a project declaration are not counted as connected.',
        capHandoff: 'Handoff summary',
        capNoHandoff: 'No handoff yet. Create a preview first, confirm it, then give it to the target AI.',
        capNoHandoffStatus: 'No record',
      },
    }

    function makeT(t) {
      return (key, params) => {
        let s = (t && t(key)) || DICT.zh[key] || key
        if (s === key) s = DICT.zh[key] || key
        if (params) for (const [k, v] of Object.entries(params)) s = s.split('{' + k + '}').join(String(v))
        return s
      }
    }

    const cx = (...xs) => xs.filter(Boolean).join(' ')
    const wbBaseName = (value) => String(value || '').split(/[\\/]/).filter(Boolean).pop() || ''
    const sameLocalPath = (a, b) => {
      const norm = (value) => String(value || '').replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase()
      return Boolean(a && b) && norm(a) === norm(b)
    }
    const projectAccent = (project) => {
      const source = String(project?.id || project?.path || project?.name || 'project')
      let hash = 0
      for (let i = 0; i < source.length; i++) hash = (hash * 31 + source.charCodeAt(i)) >>> 0
      if (project?.lifecycle === 'persistent') return 'var(--dsw-alias-brand-primary)'
      if (project?.lifecycle === 'temporary') return 'hsl(220 10% 46%)'
      if (project?.lifecycle === 'unclassified') return 'hsl(220 8% 40%)'
      return `hsl(${206 + (hash % 34)} 36% ${48 + (hash % 10)}%)`
    }
    const projectMark = (project) => {
      const name = String(project?.displayName || project?.name || '?').trim()
      const ascii = name.match(/[A-Za-z0-9]+/g)
      if (ascii?.length) return ascii.slice(0, 2).map((part) => part[0]).join('').toUpperCase()
      return name.slice(0, 2)
    }
    const fmtBytes = (n) => {
      if (!n || n < 0) return '0 B'
      const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
      let i = 0
      let v = n
      while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
      return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`
    }
    const fmtGiB = (n) => n ? (n / 1024 ** 3).toFixed(1) + ' GiB' : '—'
    function useProjectMedia(projectId, revision = '') {
      const [state, setState] = useState({ status: 'idle', data: null, error: '' })
      const requestRef = useRef(0)
      const load = useCallback((force = false) => {
        if (!projectId) { setState({ status: 'idle', data: null, error: '' }); return Promise.resolve(null) }
        const requestId = ++requestRef.current
        setState((current) => ({ status: current.data ? 'refreshing' : 'loading', data: current.data, error: '' }))
        return loadProjectMedia(projectId, force)
          .then((data) => {
            if (requestId !== requestRef.current) return null
            setState({ status: 'ready', data, error: data?.error || '' })
            return data
          })
          .catch((error) => {
            if (requestId !== requestRef.current) return null
            setState((current) => ({ status: 'error', data: current.data, error: error?.message || String(error) }))
            return null
          })
      }, [projectId])
      useEffect(() => {
        setState({ status: projectId ? 'loading' : 'idle', data: null, error: '' })
        load(false)
        return () => { requestRef.current += 1 }
      }, [load, projectId, revision])
      return { ...state, reload: () => load(true) }
    }
    const fmtDate = (iso) => {
      if (!iso) return '—'
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return '—'
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    const fmtDateTime = (value) => {
      if (!value) return '—'
      const d = new Date(value)
      if (Number.isNaN(d.getTime())) return '—'
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    }
    const daysBetween = (a, b) => Math.max(0, Math.round((b - a) / 86400000))
    const isSameLocalDay = (iso) => {
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return false
      const now = new Date()
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
    }
    const activityMs = (value) => {
      if (value == null || value === '') return 0
      const time = new Date(value).getTime()
      return Number.isFinite(time) ? time : 0
    }
    const relTime = (iso, tr) => {
      if (!iso) return '—'
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return '—'
      const days = daysBetween(d.getTime(), Date.now())
      if (days <= 0) return tr('today')
      if (days === 1) return tr('yesterday')
      if (days < 7) return tr('daysAgo', { n: days })
      if (days < 45) return tr('daysAgo', { n: days })
      if (days < 365) return tr('monthsAgo', { n: Math.max(1, Math.round(days / 30)) })
      return `${Math.floor(days / 365)}y ${Math.round((days % 365) / 30)}m`
    }
    const truncate = (s, n) => !s ? '' : (s.length > n ? s.slice(0, n - 1) + '…' : s)
    const normalizePath = (value) => String(value || '').replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase()
    const projectForCwd = (cwd, projects) => {
      const target = normalizePath(cwd)
      if (!target) return null
      let best = null
      let bestLength = -1
      for (const project of projects || []) {
        const candidate = normalizePath(project?.path)
        if (!candidate) continue
        if (target !== candidate && !target.startsWith(candidate + '\\')) continue
        if (candidate.length > bestLength) {
          best = project
          bestLength = candidate.length
        }
      }
      return best
    }
    const sourceLabel = (s, tr) => s === 'codes' ? tr('codes') : s === 'dsh' ? tr('dsh') : s === 'opencode' ? tr('opencode') : s

    const handoffValue = (value, tr) => {
      const text = String(value || '').trim()
      return text || tr('handoffUnknown')
    }
    const handoffSourceLabel = (source, tr) => {
      if (source?.session?.source === 'codex') return `${tr('handoffSourceCodex')} · ${source.session.title || tr('agentUntitled')}`
      if (source?.session) return `${tr('handoffDshSource')} · ${source.session.title || tr('agentUntitled')}`
      return tr('handoffManual')
    }
    const textValue = (value) => {
      if (typeof value === 'string') return value
      if (value == null) return ''
      if (typeof value === 'number' || typeof value === 'boolean') return String(value)
      if (typeof value === 'object' && typeof value.text === 'string') return value.text
      return ''
    }
    const parseHandoffDoc = (doc) => {
      const text = String(doc || '')
      if (!text) return {}
      const headings = [...text.matchAll(/^##\s+([1-6])\.\s*[^\n]*$/gm)]
      const sections = {}
      headings.forEach((heading, index) => {
        const start = heading.index + heading[0].length
        const end = headings[index + 1]?.index ?? text.length
        const body = text.slice(start, end).replace(/\n---[\s\S]*$/, '').trim()
        if (body) sections[Number(heading[1])] = body
      })
      return {
        goal: sections[1] || '',
        progress: sections[2] || '',
        constraints: sections[3] || '',
        files: sections[4] || '',
        summary: sections[5] || '',
      }
    }

    const handoffTimeText = (value) => {
      const numeric = Number(value)
      if (Number.isFinite(numeric) && numeric > 0) return fmtDateTime(new Date(numeric).toISOString())
      return fmtDateTime(value)
    }
    const handoffAbuse = /(?:傻逼|操你妈|操你|妈的|狗娘|婊子|fuck|shit|bitch|asshole|motherfucker)/i
    const handoffDirective = /(?:请|麻烦|帮我|把|改|重新|重来|不要|别|必须|应该|需要|统一|修复|生成|检查|保留|使用|删除|停止|记住|先|换|补|移除|增加|减少|只|按)/i
    const handoffPureQuestion = /^(?:为什么|为何|怎么|如何|是否|你是|你不是|那你是|你为什么|能不能|可以吗)/i
    const filterHandoffCorrections = (items) => {
      const result = []
      const seen = new Set()
      for (const item of Array.isArray(items) ? items : []) {
        const text = textValue(item).replace(/\s+/g, ' ').trim()
        if (!text || text.length > 500) continue
        if (handoffAbuse.test(text)) continue
        if (handoffPureQuestion.test(text) && !/^(?:请|麻烦|帮我|把|需要|必须|应该|不要|别|先|重新|统一|修复)/i.test(text)) continue
        if (!handoffDirective.test(text)) continue
        const key = text.toLowerCase().replace(/[\s，。！？、；：,.!?;:]/g, '')
        if (!key || seen.has(key)) continue
        seen.add(key)
        result.push(text)
      }
      return result.slice(-3)
    }
    const handoffTruthText = (source, tr) => {
      const docs = Array.isArray(source?.truthDocs) ? source.truthDocs : []
      const status = String(source?.truthDocsStatus || (docs.length ? 'read' : 'not-read'))
      if (!docs.length) {
        const reason = status === 'none' ? `（${tr('handoffTruthDocsNotFound')}）` : ''
        return `${tr('handoffTruthDocs')}：${tr('handoffTruthDocsUnread')}${reason}`
      }
      return `${tr('handoffTruthDocs')}：\n${docs.slice(0, 8).map((doc) => {
        const name = textValue(doc?.name) || wbBaseName(doc?.path) || tr('handoffUnknown')
        const mtime = handoffTimeText(doc?.mtime)
        const size = Number.isFinite(Number(doc?.size)) ? fmtBytes(Number(doc.size)) : '—'
        return `- ${name} · ${mtime} · ${size}\n  ${textValue(doc?.path) || tr('handoffUnknown')}`
      }).join('\n')}`
    }
    const buildHandoffValues = (source, tr) => {
      const project = source?.project || null
      const session = source?.session || null
      const digest = source?.digest || null
      const latestUser = textValue(digest?.latestUser)
      const latestAssistant = textValue(digest?.latestAssistant)
      const fromDoc = parseHandoffDoc(source?.handoffDoc)
      const usable = (value) => {
        const text = textValue(value).trim()
        return text && text !== tr('handoffUnknown') && text !== tr('handoffNoProgress') ? text : ''
      }
      const presetGoal = textValue(source?.presetGoal).trim()
      const docGoalCandidate = usable(fromDoc.goal)
      const docMtime = Date.parse(source?.handoffDocMtime)
      const sessionMtime = Date.parse(session?.updatedAt || digest?.updatedAt)
      // A goal in an older handoff document is history, not the current goal.
      // If either timestamp is unavailable, keep the explicit document goal.
      const docGoal = (!Number.isFinite(docMtime) || !Number.isFinite(sessionMtime) || docMtime >= sessionMtime)
        ? docGoalCandidate
        : ''
      const goalText = presetGoal || docGoal || tr('handoffDefaultGoal')
      const goalSource = presetGoal ? 'preset' : docGoal ? 'doc' : 'default'
      const firstUser = textValue(digest?.firstUser)
      const corrections = filterHandoffCorrections(digest?.corrections)

      const progressParts = []
      const tailSummary = textValue(digest?.summary) || latestAssistant
      if (tailSummary) progressParts.push(tailSummary)
      const lastTurn = digest?.lastTurn && typeof digest.lastTurn === 'object' ? digest.lastTurn : null
      if (lastTurn?.kind) {
        const at = lastTurn.time ? `（${handoffTimeText(lastTurn.time)}）` : ''
        progressParts.push(`${tr('handoffLatestStatus')}：${lastTurn.kind}${at}`)
      }
      const lastError = digest?.lastError && typeof digest.lastError === 'object' ? digest.lastError : null
      if (textValue(lastError?.message)) {
        const origin = lastError.source ? `（${lastError.source}）` : ''
        progressParts.push(`${tr('handoffLatestError')}：${textValue(lastError.message)}${origin}`)
      }
      progressParts.push(handoffTruthText(source, tr))
      const progressText = progressParts.filter(Boolean).join('\n\n')

      const contextParts = []
      if (firstUser && firstUser !== latestUser && !handoffAbuse.test(firstUser)) {
        contextParts.push(`最初目标：${truncate(firstUser, 700)}`)
      }
      if (corrections.length) {
        contextParts.push(`${tr('handoffRecentUserContext')}：\n${corrections.map((item) => `- ${item}`).join('\n')}`)
      }
      const contextText = contextParts.join('\n\n')
      // Corrections are evidence, never constraints. Only the user-confirmed
      // project document's constraints survive into the handoff.
      const constraintParts = [usable(fromDoc.constraints)].filter(Boolean)
      const read = digest?.read
      const readBoundary = read
        ? `来源 ${digest?.source || 'session'} · 读取 ${read.lines || 0} 行 / ${read.scannedBytes || 0} 字节${read.truncated ? '（已截断）' : '（完整）'}`
        : ''
      return {
        projectName: project?.displayName || project?.name || session?.projectName || tr('handoffNoProject'),
        projectPath: project?.path || session?.cwd || '',
        sourceLabel: handoffSourceLabel(source, tr),
        sourceSessionId: session?.id || '',
        sourceUpdatedAt: session?.updatedAt || '',
        readBoundary,
        goal: truncate(goalText, 4000),
        goalSource,
        progress: truncate(progressText || tr('handoffNoProgress'), 6000),
        constraints: truncate(constraintParts.join('\n\n'), 4000),
        files: truncate(usable(fromDoc.files) || [project?.path || session?.cwd || '', project?.git?.branch ? `${tr('branch')}: ${project.git.branch}` : ''].filter(Boolean).join('\n'), 4000),
        summary: truncate(progressText ? [progressText, contextText].filter(Boolean).join('\n\n') : tr('handoffNoProgress'), 5000),
        notice: [textValue(digest?.notice), textValue(source?.error)].filter(Boolean).join(' '),
      }
    }
    const buildHandoffPrompt = (values, tr) => {
      const lines = [
        `# ${tr('handoffPromptTitle')}`,
        '',
        `${tr('handoffProject')}: ${handoffValue(values.projectName, tr)}`,
        `${tr('handoffPath')}: ${handoffValue(values.projectPath, tr)}`,
        `${tr('handoffSource')}: ${handoffValue(values.sourceLabel, tr)}`,
      ]
      if (values.sourceSessionId) lines.push(`${tr('handoffSourceSession')}: ${values.sourceSessionId}`)
      if (values.sourceUpdatedAt) lines.push(`来源更新时间: ${fmtDateTime(values.sourceUpdatedAt)}`)
      if (values.readBoundary) lines.push(`读取边界: ${values.readBoundary}`)
      lines.push(
        `${tr('handoffGeneratedAt')}: ${fmtDateTime(new Date().toISOString())}`,
        '',
        `## 1. ${tr('handoffGoal')}`,
        handoffValue(values.goal, tr),
        '',
        `## 2. ${tr('handoffProgress')}`,
        handoffValue(values.progress, tr),
        '',
        `## 3. ${tr('handoffConstraints')}`,
        handoffValue(values.constraints, tr),
        '',
        `## 4. ${tr('handoffFiles')}`,
        handoffValue(values.files, tr),
      )
      lines.push('', `## 5. ${tr('handoffSummary')}`, handoffValue(values.summary, tr))
      lines.push('', `## 6. ${tr('handoffRulesLabel')}`, tr('handoffRules'))
      return lines.join('\n')
    }
    const findLatestSessionForProject = (agentRuntime, projectPath) => {
      const target = normalizePath(projectPath)
      if (!target) return null
      try {
        const snapshot = agentRuntime?.getSessions?.()?.list?.getSnapshot?.()
        if (!snapshot || !Array.isArray(snapshot.ids)) return null
        let best = null
        let bestTime = -1
        for (const id of snapshot.ids) {
          const raw = snapshot.byId?.[id]
          if (!raw || raw.blank === true) continue
          const cwd = normalizePath(raw.cwd)
          if (!cwd || (cwd !== target && !cwd.startsWith(target + '\\'))) continue
          const time = Date.parse(raw.updatedAt || '') || 0
          if (time > bestTime) {
            bestTime = time
            best = {
              id,
              title: String(raw.title || raw.displayTitle || ''),
              cwd: raw.cwd,
              updatedAt: raw.updatedAt,
              running: raw.running === true,
            }
          }
        }
        return best
      } catch {
        return null
      }
    }
    const fetchDigestForSession = async (session) => {
      const params = new URLSearchParams({ id: session.id })
      if (session.source === 'codex') params.set('source', 'codex')
      if (session.title) params.set('title', session.title)
      const response = await fetch(`${API}/session-digest?${params.toString()}`, { cache: 'no-store' })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || json.ok === false) throw new Error(json.error || `HTTP ${response.status}`)
      return json
    }

    function statusColor(status) {
      return status === 'active' ? 'var(--dsw-alias-state-success-primary)'
        : status === 'paused' ? 'var(--dsw-alias-state-warn-primary)'
        : status === 'archived' ? 'var(--dsw-alias-label-tertiary)'
        : 'var(--dsw-alias-label-dimmed)'
    }
    function statusLabel(status, tr) {
      return status === 'active' ? tr('active') : status === 'paused' ? tr('paused') : status === 'archived' ? tr('archived') : tr('unknown')
    }
    function lifecycleLabel(lifecycle, tr) {
      const key = lifecycle === 'persistent' ? 'lifecyclePersistent'
        : lifecycle === 'incubating' ? 'lifecycleIncubating'
        : lifecycle === 'temporary' ? 'lifecycleTemporary'
        : 'lifecycleUnclassified'
      return tr(key)
    }
    function lifecycleSourceLabel(source, tr) {
      return source === 'manual' ? tr('lifecycleManual')
        : source === 'manifest' ? tr('lifecycleManifest')
        : source === 'handoff' ? tr('lifecycleHandoff')
        : tr('lifecycleInferred')
    }
    const prefersReducedMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)
    function useCountUp(value, duration = 620) {
      const target = Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : 0
      const [display, setDisplay] = useState(0)
      const shown = useRef(0)
      useEffect(() => {
        const from = shown.current
        if (prefersReducedMotion() || from === target) {
          shown.current = target
          setDisplay(target)
          return undefined
        }
        let raf = 0
        const started = performance.now()
        const tick = (now) => {
          const progress = Math.min(1, (now - started) / duration)
          const eased = 1 - Math.pow(1 - progress, 3)
          const next = Math.round(from + (target - from) * eased)
          shown.current = next
          setDisplay(next)
          if (progress < 1) raf = requestAnimationFrame(tick)
          else shown.current = target
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
      }, [target, duration])
      return display
    }
    function CountUp({ value }) {
      return h('span', { className: 'wb-count' }, String(useCountUp(value)))
    }
    function projectTone(p) {
      const runtimeState = p.runtime?.state || ''
      if (runtimeState === 'running') return 'running'
      if (runtimeState === 'waiting') return 'waiting'
      if (runtimeState === 'blocked' || runtimeState === 'failed') return 'failed'
      if (p.needsFollowup) return 'attention'
      if (p.status === 'active') return 'active'
      return 'idle'
    }
    const projectMorphNode = (node) => node?.querySelector?.('[data-wb-morph-title]') || node
    const markProjectMorph = (node) => {
      const title = projectMorphNode(node)
      if (!title) return null
      title.dataset.wbMorph = '1'
      title.style.viewTransitionName = 'wb-project-morph'
      return title
    }
    const clearProjectMorph = () => {
      document.querySelectorAll('[data-wb-morph]').forEach((node) => {
        node.style.viewTransitionName = ''
        delete node.dataset.wbMorph
      })
    }
    function integrationLevel(integration) {
      const kind = String(integration?.kind || '').trim().toLowerCase()
      if (!kind) return 'index'
      if (['dsh-panel', 'agent', 'project'].includes(kind)) return 'project'
      if (['app-api', 'cli', 'adapter', 'http-api', 'plugin'].includes(kind)) return 'app'
      return 'unknown'
    }
    function integrationLevelLabel(level, tr) {
      return level === 'project' ? tr('integrationProject')
        : level === 'app' ? tr('integrationApp')
        : level === 'unknown' ? tr('integrationUnknown')
        : tr('integrationIndex')
    }
    function integrationChipLabel(level, tr) {
      return level === 'project' ? tr('integrationChipProject')
        : level === 'app' ? tr('integrationChipApp')
        : level === 'unknown' ? tr('integrationChipUnknown')
        : tr('integrationChipIndex')
    }

    function Glyph({ name, size = 18, className = '' }) {
      const common = {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round',
        className, 'aria-hidden': true,
      }
      const p = {
        grid: [h('rect', { key: 'a', x: 3, y: 3, width: 7, height: 7, rx: 1.5 }), h('rect', { key: 'b', x: 14, y: 3, width: 7, height: 7, rx: 1.5 }), h('rect', { key: 'c', x: 3, y: 14, width: 7, height: 7, rx: 1.5 }), h('rect', { key: 'd', x: 14, y: 14, width: 7, height: 7, rx: 1.5 })],
        globe: [h('circle', { key: 'a', cx: 12, cy: 12, r: 9 }), h('path', { key: 'b', d: 'M3 12h18M12 3c2.7 2.5 4.2 5.6 4.2 9s-1.5 6.5-4.2 9c-2.7-2.5-4.2-5.6-4.2-9S9.3 5.5 12 3z' })],
        timeline: [h('path', { key: 'a', d: 'M4 6h9M4 12h14M4 18h6' }), h('circle', { key: 'b', cx: 17, cy: 6, r: 2 }), h('circle', { key: 'c', cx: 10, cy: 18, r: 2 })],
        library: [h('path', { key: 'a', d: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z' }), h('path', { key: 'b', d: 'M4 18.5A2.5 2.5 0 0 1 6.5 16H20' })],
        image: [h('rect', { key: 'a', x: 3, y: 4, width: 18, height: 16, rx: 2 }), h('circle', { key: 'b', cx: 8.5, cy: 9.5, r: 1.5 }), h('path', { key: 'c', d: 'M4 17l5-5 4 4 2-2 5 5' })],
        disk: [h('rect', { key: 'a', x: 3, y: 4, width: 18, height: 16, rx: 3 }), h('path', { key: 'b', d: 'M3 12h18' }), h('circle', { key: 'c', cx: 17, cy: 8, r: 1 })],
        software: [h('rect', { key: 'a', x: 3, y: 3, width: 18, height: 18, rx: 4 }), h('path', { key: 'b', d: 'M8 9l3 3-3 3M13 15h3' })],
        overview: [h('path', { key: 'a', d: 'M4 19V9M10 19V5M16 19v-7M22 19H2' })],
        search: [h('circle', { key: 'a', cx: 11, cy: 11, r: 6.5 }), h('path', { key: 'b', d: 'M20 20l-3.6-3.6' })],
        refresh: [h('path', { key: 'a', d: 'M20 11a8 8 0 1 0-2.3 5.7' }), h('path', { key: 'b', d: 'M20 4v7h-7' })],
        folder: [h('path', { key: 'a', d: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' })],
        external: [h('path', { key: 'a', d: 'M14 4h6v6M20 4l-9 9' }), h('path', { key: 'b', d: 'M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4' })],
        copy: [h('rect', { key: 'a', x: 9, y: 9, width: 11, height: 11, rx: 2 }), h('path', { key: 'b', d: 'M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1' })],
        close: [h('path', { key: 'a', d: 'M6 6l12 12M18 6L6 18' })],
        pin: [h('path', { key: 'a', d: 'M9 4h6l-1 6 3 3v2H7v-2l3-3z' }), h('path', { key: 'b', d: 'M12 15v6' })],
        chevron: [h('path', { key: 'a', d: 'M9 6l6 6-6 6' })],
        check: [h('path', { key: 'a', d: 'M5 12.5l4.5 4.5L19 7.5' })],
        flag: [h('path', { key: 'a', d: 'M5 21V4M5 4h11l-2 4 2 4H5' })],
        spark: [h('path', { key: 'a', d: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z' })],
        agent: [h('rect', { key: 'a', x: 4, y: 7, width: 16, height: 12, rx: 4 }), h('path', { key: 'b', d: 'M12 3v4M8 13h.01M16 13h.01M9 16h6' })],
        alert: [h('path', { key: 'a', d: 'M12 3l9 16H3z' }), h('path', { key: 'b', d: 'M12 9v4M12 16.5v.5' })],
        clock: [h('circle', { key: 'a', cx: 12, cy: 12, r: 9 }), h('path', { key: 'b', d: 'M12 7v5l3 2' })],
        layers: [h('path', { key: 'a', d: 'M12 3l9 5-9 5-9-5z' }), h('path', { key: 'b', d: 'M3 12l9 5 9-5M3 16l9 5 9-5' })],
        tag: [h('path', { key: 'a', d: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z' }), h('circle', { key: 'b', cx: 7.5, cy: 7.5, r: 1.2 })],
        filter: [h('path', { key: 'a', d: 'M3 5h18M6 12h12M10 19h4' })],
        list: [h('path', { key: 'a', d: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' })],
        moon: [h('path', { key: 'a', d: 'M20 14.5A8 8 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z' })],
        arrow: [h('path', { key: 'a', d: 'M5 12h14M13 6l6 6-6 6' })],
        mouse: [h('rect', { key: 'a', x: 8, y: 2.5, width: 8, height: 19, rx: 4 }), h('path', { key: 'b', d: 'M12 6.5v4' })],
        fork: [h('circle', { key: 'a', cx: 6, cy: 6, r: 2 }), h('circle', { key: 'b', cx: 18, cy: 6, r: 2 }), h('circle', { key: 'c', cx: 12, cy: 18, r: 2 }), h('path', { key: 'd', d: 'M6 8v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V8M12 14v2' })],
        box: [h('path', { key: 'a', d: 'M4 7l8-4 8 4v10l-8 4-8-4z' }), h('path', { key: 'b', d: 'M4 7l8 4 8-4M12 11v10' })],
        trash: [h('path', { key: 'a', d: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13' }), h('path', { key: 'b', d: 'M10 11v5M14 11v5' })],
      }[name]
      return h('svg', common, p || [])
    }

    function WorkbenchGlyph({ size = 20, active = false }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        'aria-hidden': true, style: { display: 'block' },
      }, [
        h('rect', { key: 'bg', x: 2.5, y: 2.5, width: 19, height: 19, rx: 5.5, fill: active ? 'currentColor' : 'none', stroke: 'currentColor', strokeOpacity: active ? 1 : 0.85, strokeWidth: 1.5 }),
        h('path', { key: 'a', d: 'M7 8h10M7 12h6M7 16h8', stroke: active ? 'var(--dsw-alias-bg-base)' : 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }),
        h('circle', { key: 'b', cx: 17, cy: 16, r: 1.6, fill: active ? 'var(--dsw-alias-bg-base)' : 'currentColor' }),
      ])
    }

    const CSS = `
.wb-root{--wb-radius:16px;--wb-gap:16px;position:relative;height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;color:var(--dsw-alias-label-primary);background:
radial-gradient(1100px 520px at 8% -12%, color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent), transparent 65%),
radial-gradient(900px 460px at 100% 0%, color-mix(in srgb, #22d3ee 7%, transparent), transparent 62%),
var(--dsw-alias-bg-base);font-family:inherit}
.wb-root *{box-sizing:border-box}
.wb-root h1,.wb-root h2,.wb-root h3,.wb-root h4,.wb-root h5,.wb-root h6{color:var(--dsw-alias-label-primary)}
.wb-root ::selection{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 28%,transparent)}
.wb-header{flex:0 0 auto;border-bottom:1px solid var(--dsw-alias-border-l1);background:color-mix(in srgb,var(--dsw-alias-bg-base) 78%,transparent);backdrop-filter:blur(14px)}
.wb-header.has-modebar{border-bottom:0}
.wb-header-inner{max-width:1560px;margin:0 auto;padding:14px 24px 12px;display:flex;align-items:center;gap:16px}
.wb-brand{display:flex;align-items:center;gap:12px;min-width:0}
.wb-brand-mark{width:36px;height:36px;border-radius:12px;display:grid;place-items:center;color:var(--dsw-alias-brand-primary);background:linear-gradient(145deg,color-mix(in srgb,var(--dsw-alias-brand-primary) 18%,transparent),color-mix(in srgb,#22d3ee 8%,transparent));border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 35%,transparent);box-shadow:0 0 24px color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent)}
.wb-title{font-size:16px;font-weight:700;letter-spacing:.2px;line-height:1.2}
.wb-version{display:inline-flex;align-items:center;margin-left:7px;padding:1px 5px;border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 24%,var(--dsw-alias-border-l1));border-radius:5px;font-size:9px;line-height:13px;font-weight:700;color:var(--dsw-alias-brand-primary);vertical-align:2px;letter-spacing:.3px}
.wb-subtitle{font-size:12px;color:var(--dsw-alias-label-tertiary);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-header-spacer{flex:1}
.wb-scan-state{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.wb-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-label-tertiary);display:inline-block;flex:0 0 auto}
.wb-dot.scan{background:var(--dsw-alias-state-warn-primary);animation:wb-pulse 1.2s ease-in-out infinite}
@keyframes wb-pulse{0%,100%{opacity:1}50%{opacity:.45}}
.wb-btn{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:10px;padding:8px 12px;font:inherit;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:7px;cursor:pointer;transition:background .15s,border-color .15s,transform .15s;white-space:nowrap}
.wb-btn:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l3)}
.wb-btn:active{transform:translateY(1px)}
.wb-btn.primary{background:var(--dsw-alias-button-primary-fill);border-color:transparent;color:var(--dsw-alias-label-primary-foreground)}
.wb-btn.primary:hover{filter:brightness(1.08)}
.wb-btn.ghost{background:transparent;border-color:transparent;color:var(--dsw-alias-label-secondary)}
.wb-btn.ghost:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.wb-btn.icon{padding:8px;width:34px;height:34px;justify-content:center}
.wb-btn:disabled{opacity:.55;cursor:default;transform:none}
.wb-btn.danger{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 38%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent)}
.wb-btn.danger:hover{background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 18%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 55%,transparent)}
.wb-select-check{width:15px;height:15px;accent-color:var(--dsw-alias-brand-primary);margin:1px 0 0;flex:0 0 auto;cursor:pointer}
.wb-select-check:disabled{cursor:not-allowed;opacity:.35}
.wb-card.selected{border-color:var(--dsw-alias-brand-primary);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 7%,var(--dsw-alias-bg-layer-1));box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-brand-primary) 45%,transparent)}
.wb-card.not-selectable{opacity:.55;cursor:default}
.wb-card.not-selectable:hover{transform:none;border-color:var(--dsw-alias-border-l1)}
.wb-table tbody tr.not-selectable{opacity:.55;cursor:default}
.wb-batchbar{position:sticky;top:8px;z-index:40;display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 12px;border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 30%,var(--dsw-alias-border-l2));background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 92%,transparent);backdrop-filter:blur(12px);border-radius:12px;margin:0 0 12px;box-shadow:0 8px 28px color-mix(in srgb,#000 18%,transparent)}
.wb-batchbar-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-left:auto}
.wb-batchbar .grow{flex:1;min-width:160px}
.wb-batchbar-meta{font-size:12px;font-weight:700;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}
.wb-batchbar-hint{font-size:11px;color:var(--dsw-alias-label-tertiary);margin-left:8px;line-height:1.5}
.wb-modal-backdrop{position:fixed;inset:0;z-index:940;background:color-mix(in srgb,#000 52%,transparent);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:24px;animation:wb-fade .18s ease}
.wb-modal{width:min(680px,96vw);max-height:min(780px,92vh);display:flex;flex-direction:column;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:16px;box-shadow:0 30px 90px color-mix(in srgb,#000 48%,transparent);overflow:hidden;animation:wb-modal-in .22s var(--wb-ease)}
.wb-modal-head{flex:0 0 auto;display:flex;align-items:flex-start;gap:12px;padding:18px 20px 14px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.wb-modal-title{font-size:18px;line-height:26px;font-weight:700;min-width:0}
.wb-modal-sub{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);margin-top:4px}
.wb-modal-body{flex:1;min-height:0;overflow:auto;padding:16px 20px}
.wb-modal-foot{flex:0 0 auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 20px;border-top:1px solid var(--dsw-alias-border-l1);background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 70%,transparent)}
.wb-modal-foot .grow{flex:1}
.wb-handoff-modal{width:min(760px,96vw)}
.wb-handoff-body{display:flex;flex-direction:column;gap:12px}
.wb-handoff-source{display:flex;align-items:flex-start;gap:9px;padding:10px 11px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 72%,transparent);color:var(--dsw-alias-label-secondary)}
.wb-handoff-source-title{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary);line-height:18px}
.wb-handoff-source-path{font-size:11px;line-height:17px;color:var(--dsw-alias-label-tertiary);word-break:break-all;margin-top:2px}
.wb-handoff-field{display:flex;flex-direction:column;gap:5px;min-width:0}
.wb-handoff-label{font-size:12px;font-weight:600;line-height:18px;color:var(--dsw-alias-label-primary)}
.wb-handoff-required{color:var(--dsw-alias-state-error-primary)}
.wb-handoff-field .wb-textarea{min-height:76px}
.wb-handoff-field .wb-handoff-preview{min-height:178px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;line-height:1.6;background:var(--dsw-alias-bg-layer-1)}
.wb-handoff-hint{font-size:11px;line-height:17px;color:var(--dsw-alias-label-tertiary)}
.wb-handoff-note{display:flex;align-items:flex-start;gap:7px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-warn-primary) 32%,var(--dsw-alias-border-l1));background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 8%,transparent);color:var(--dsw-alias-label-secondary);border-radius:9px;padding:9px 10px;font-size:11px;line-height:17px}
.wb-handoff-warning .wb-btn{margin-top:8px}
@media (max-width:760px){.wb-handoff-modal{max-height:94vh}.wb-modal-body.wb-handoff-body{padding:14px 16px}.wb-modal-foot{padding:10px 16px}}
.wb-mode-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}
.wb-mode-option{display:flex;align-items:flex-start;gap:7px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:10px;cursor:pointer;font-size:12px;line-height:17px;color:var(--dsw-alias-label-secondary);transition:border-color .15s,background .15s}
.wb-mode-option:hover{background:var(--dsw-alias-interactive-bg-hover)}
.wb-mode-option.on{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 55%,var(--dsw-alias-border-l1));background:color-mix(in srgb,var(--dsw-alias-brand-primary) 8%,transparent);color:var(--dsw-alias-label-primary)}
.wb-mode-option input{accent-color:var(--dsw-alias-brand-primary);margin:2px 0 0;flex:0 0 auto}
.wb-mode-option strong{display:block;color:var(--dsw-alias-label-primary);font-weight:600;margin-bottom:2px}
.wb-delete-list{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;overflow:auto;max-height:250px;margin-top:12px}
.wb-delete-row{display:grid;grid-template-columns:20px minmax(0,1fr) auto;gap:8px;align-items:start;padding:9px 10px;border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-border-l1) 60%,transparent);cursor:pointer;font-size:12px}
.wb-delete-row:last-child{border-bottom:0}
.wb-delete-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.wb-delete-row input{accent-color:var(--dsw-alias-brand-primary);margin:2px 0 0}
.wb-delete-name{font-weight:600;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb-delete-path{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);word-break:break-all;margin-top:2px}
.wb-delete-size{font-size:11px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;font-variant-numeric:tabular-nums;padding-top:1px}
.wb-delete-warning{display:flex;gap:7px;align-items:flex-start;border:1px solid color-mix(in srgb,var(--dsw-alias-state-warn-primary) 32%,var(--dsw-alias-border-l1));background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 8%,transparent);color:var(--dsw-alias-label-secondary);border-radius:10px;padding:9px 10px;font-size:12px;line-height:18px;margin-top:12px}
.wb-delete-ack{display:flex;align-items:flex-start;gap:8px;font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary);margin-top:12px;cursor:pointer}
.wb-delete-ack input{accent-color:var(--dsw-alias-state-error-primary);margin:2px 0 0;flex:0 0 auto}
.wb-modal-error{border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary) 35%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 8%,transparent);color:var(--dsw-alias-state-error-primary);border-radius:8px;padding:8px 10px;font-size:12px;line-height:18px;margin-top:12px;word-break:break-word}
.wb-modal-hint{font-size:11px;line-height:17px;color:var(--dsw-alias-label-tertiary);margin-top:10px}
@keyframes wb-fade{from{opacity:0}to{opacity:1}}
@keyframes wb-modal-in{from{opacity:0;transform:translateY(8px) scale(.985)}to{opacity:1;transform:none}}
@media(max-width:640px){.wb-modal-backdrop{padding:10px}.wb-mode-grid{grid-template-columns:1fr}.wb-batchbar-hint{display:none}}
.wb-main{flex:1;min-height:0;overflow:auto;scrollbar-gutter:stable}
.wb-shell{max-width:1560px;margin:0 auto;padding:20px 24px 56px}
.wb-tabs{display:flex;align-items:center;gap:4px;border-bottom:1px solid var(--dsw-alias-border-l1);margin-bottom:18px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none}
.wb-tabs::-webkit-scrollbar{display:none}
.wb-tab{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:12px;font-weight:600;padding:10px 13px 12px;display:inline-flex;align-items:center;gap:7px;cursor:pointer;position:relative;white-space:nowrap;border-radius:8px 8px 0 0;transition:color .15s,background .15s}
.wb-tab:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
.wb-tab.active{color:var(--dsw-alias-label-primary)}
.wb-tab.active::after{content:"";position:absolute;left:10px;right:10px;bottom:-1px;height:2px;border-radius:2px;background:var(--dsw-alias-brand-primary);box-shadow:0 0 10px color-mix(in srgb,var(--dsw-alias-brand-primary) 55%,transparent)}
.wb-panel{border:1px solid var(--dsw-alias-border-l1);background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 84%,transparent);border-radius:var(--wb-radius);overflow:hidden}
.wb-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:15px 17px 11px}
.wb-panel-title{font-size:12px;font-weight:700;letter-spacing:.1px;display:flex;align-items:center;gap:8px}
.wb-panel-sub{font-size:12px;color:var(--dsw-alias-label-tertiary);margin-top:4px;line-height:1.45}
.wb-panel-body{padding:0 17px 16px}
.wb-list{display:flex;flex-direction:column}
.wb-row{display:flex;align-items:center;gap:11px;padding:9px 0;border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-border-l1) 65%,transparent);cursor:pointer;min-width:0}
.wb-row:last-child{border-bottom:0}
.wb-row:hover .wb-row-name{color:var(--dsw-alias-link)}
.wb-rank{width:20px;font-size:12px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;flex:0 0 auto}
.wb-row-main{flex:1;min-width:0}
.wb-row-name{font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color .15s}
.wb-row-meta{font-size:12px;color:var(--dsw-alias-label-tertiary);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-row-right{font-size:12px;color:var(--dsw-alias-label-tertiary);text-align:right;flex:0 0 auto;font-variant-numeric:tabular-nums}
.wb-status-pill{display:inline-flex;align-items:center;gap:5px;padding:2px 7px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid color-mix(in srgb,var(--pill-color) 30%,transparent);background:color-mix(in srgb,var(--pill-color) 10%,transparent);color:var(--pill-color);white-space:nowrap}
.wb-status-pill .wb-dot{width:5px;height:5px;background:currentColor}
.wb-tools{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:14px}
.wb-search{position:relative;flex:1;min-width:210px;max-width:420px}
.wb-search .wb-input{padding-left:34px}
.wb-search-icon{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--dsw-alias-label-tertiary);pointer-events:none;display:flex}
.wb-input,.wb-select{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:9px;padding:7px 10px;font:inherit;font-size:12px;outline:none;transition:border-color .15s,box-shadow .15s;min-height:34px}
.wb-input:focus,.wb-select:focus{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 13%,transparent)}
.wb-select{padding-right:28px;background-image:linear-gradient(45deg,transparent 50%,var(--dsw-alias-label-tertiary) 50%),linear-gradient(135deg,var(--dsw-alias-label-tertiary) 50%,transparent 50%);background-position:calc(100% - 14px) 14px,calc(100% - 9px) 14px;background-size:5px 5px,5px 5px;background-repeat:no-repeat}
.wb-seg{display:inline-flex;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;overflow:hidden;background:var(--dsw-alias-bg-layer-1)}
.wb-seg button{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:12px;font-weight:600;padding:7px 10px;cursor:pointer;display:inline-flex;align-items:center;gap:5px}
.wb-seg button:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}
.wb-seg button.on{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 14%,transparent);color:var(--dsw-alias-label-primary)}
.wb-check{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap;user-select:none}
.wb-check input{accent-color:var(--dsw-alias-brand-primary)}
.wb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(318px,1fr));gap:12px}
.wb-card{position:relative;border:1px solid var(--dsw-alias-border-l1);background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 78%,transparent);border-radius:14px;padding:14px 15px 12px;cursor:pointer;transition:border-color .18s,transform .18s,background .18s;overflow:hidden;min-width:0}
.wb-card:hover{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 40%,var(--dsw-alias-border-l2));transform:translateY(-2px);background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 80%,transparent)}
.wb-card::before{content:"";position:absolute;left:15px;right:15px;top:0;height:1px;background:linear-gradient(90deg,transparent,var(--dsw-alias-brand-primary),transparent);opacity:0;transition:opacity .2s}
.wb-card:hover::before{opacity:.7}
.wb-card-top{display:flex;align-items:flex-start;gap:8px}
.wb-card-name{font-size:12px;font-weight:700;line-height:1.28;flex:1;min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.wb-pin{color:var(--dsw-alias-brand-primary);display:flex;flex:0 0 auto;margin-top:1px}
.wb-card-note{font-size:12px;line-height:1.55;color:var(--dsw-alias-label-secondary);margin-top:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:35px}
.wb-card-note.empty{color:var(--dsw-alias-label-dimmed);font-style:italic}
.wb-card-meta{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:10px;font-size:12px;color:var(--dsw-alias-label-tertiary)}
.wb-card-foot{display:flex;align-items:center;gap:6px;margin-top:10px;padding-top:9px;border-top:1px solid color-mix(in srgb,var(--dsw-alias-border-l1) 60%,transparent);min-width:0}
/* The home board is an attention surface, not a BI dashboard. */
.wb-summary{display:flex;align-items:center;gap:0;flex-wrap:wrap;margin-bottom:14px;padding:9px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 74%,transparent);min-width:0}
.wb-summary-item{display:inline-flex;align-items:baseline;gap:5px;padding:0 12px;border-right:1px solid var(--dsw-alias-border-l1);font-size:11px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.wb-summary-item:first-child{padding-left:2px}
.wb-summary-item:last-child{border-right:0}
.wb-summary-item b{font-size:14px;line-height:18px;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}
.wb-summary-item.is-alert b{color:var(--dsw-alias-state-warn-primary)}
.wb-summary-spacer{flex:1;min-width:8px}
@media (max-width:760px){.wb-summary{overflow-x:auto}.wb-summary-item{padding:0 9px}}
.wb-chip{display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:5px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);font-size:12px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.wb-chip.accent{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 22%,transparent);color:var(--dsw-alias-brand-primary)}
.wb-path{font-size:12px;color:var(--dsw-alias-label-dimmed);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;direction:rtl;text-align:left}
.wb-table-wrap{border:1px solid var(--dsw-alias-border-l1);border-radius:14px;overflow:hidden;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 78%,transparent)}
.wb-table{width:100%;border-collapse:collapse;font-size:12px}
.wb-table th{text-align:left;font-size:12px;letter-spacing:.7px;text-transform:uppercase;color:var(--dsw-alias-label-tertiary);font-weight:600;padding:10px 13px;border-bottom:1px solid var(--dsw-alias-border-l1);background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 65%,transparent);white-space:nowrap}
.wb-table td{padding:9px 13px;border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-border-l1) 55%,transparent);vertical-align:middle}
.wb-table tr:last-child td{border-bottom:0}
.wb-table tbody tr{cursor:pointer}
.wb-table tbody tr:hover{background:var(--dsw-alias-interactive-bg-hover)}
.wb-table tbody tr:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:-2px}
.wb-table .name{font-weight:600;max-width:340px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-table .path{font-size:12px;color:var(--dsw-alias-label-tertiary);max-width:420px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-table .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.wb-table th.sel,.wb-table td.sel{width:34px;padding-right:0;text-align:center}
.wb-table tr.selected{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 7%,transparent)}
.wb-sw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(278px,1fr));gap:12px}
.wb-sw-card{border:1px solid var(--dsw-alias-border-l1);background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 78%,transparent);border-radius:14px;padding:13px 14px;display:flex;flex-direction:column;gap:9px;min-width:0;transition:border-color .18s,transform .18s}
.wb-sw-card:hover{border-color:var(--dsw-alias-border-l3);transform:translateY(-1px)}
.wb-sw-top{display:flex;align-items:center;gap:10px;min-width:0}
.wb-sw-avatar{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;font-size:14px;font-weight:700;color:var(--sw-color);background:color-mix(in srgb,var(--sw-color) 12%,transparent);border:1px solid color-mix(in srgb,var(--sw-color) 24%,transparent);flex:0 0 auto}
.wb-sw-name{font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-sw-cat{font-size:12px;color:var(--dsw-alias-label-tertiary);margin-top:2px}
.wb-sw-ver{font-size:12px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;margin-left:auto;flex:0 0 auto}
.wb-sw-path{font-size:12px;color:var(--dsw-alias-label-dimmed);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-sw-foot{display:flex;align-items:center;gap:8px;border-top:1px solid color-mix(in srgb,var(--dsw-alias-border-l1) 55%,transparent);padding-top:8px;font-size:12px;color:var(--dsw-alias-label-tertiary)}
.wb-disk-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:16px}
.wb-disk-card{border:1px solid var(--dsw-alias-border-l1);background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 80%,transparent);border-radius:14px;padding:14px}
.wb-disk-top{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.wb-disk-letter{font-size:20px;font-weight:700;letter-spacing:-.4px}
.wb-disk-free{font-size:12px;color:var(--dsw-alias-label-tertiary)}
.wb-disk-cap{font-size:12px;color:var(--dsw-alias-label-tertiary);margin-top:4px}
.wb-disk-track{height:8px;border-radius:999px;background:var(--dsw-alias-bg-layer-3);overflow:hidden;margin-top:10px}
.wb-disk-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--dsw-alias-brand-primary),#22d3ee);transition:width .6s}
.wb-disk-fill.warn{background:linear-gradient(90deg,var(--dsw-alias-state-warn-primary),var(--dsw-alias-state-error-primary))}
.wb-bars{display:flex;flex-direction:column;gap:10px}
.wb-bar-row{display:grid;grid-template-columns:1fr 58px;gap:9px;align-items:center;font-size:12px}
.wb-bar-label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dsw-alias-label-secondary)}
.wb-bar-track{grid-column:1/-1;height:5px;border-radius:999px;background:var(--dsw-alias-bg-layer-3);overflow:hidden;margin-top:-4px}
.wb-bar-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,color-mix(in srgb,var(--dsw-alias-brand-primary) 85%,transparent),#22d3ee)}
.wb-bar-val{text-align:right;font-size:12px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.wb-empty{padding:48px 20px;text-align:center;color:var(--dsw-alias-label-tertiary)}
.wb-empty-icon{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;margin:0 auto 12px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-dimmed)}
.wb-empty-title{font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary)}
.wb-empty-sub{font-size:12px;margin-top:6px;line-height:1.5}
.wb-skeleton{height:92px;border-radius:14px;background:linear-gradient(100deg,var(--dsw-alias-bg-layer-1) 20%,var(--dsw-alias-bg-layer-2) 40%,var(--dsw-alias-bg-layer-1) 60%);background-size:200% 100%;animation:wb-shimmer 1.4s linear infinite;margin-bottom:12px}
@keyframes wb-shimmer{to{background-position:-200% 0}}
.wb-error{border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary) 35%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 8%,transparent);color:var(--dsw-alias-state-error-primary);border-radius:12px;padding:12px 14px;font-size:12px;display:flex;align-items:center;gap:9px;margin-bottom:14px}
.wb-footer{padding:16px 2px 0;display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--dsw-alias-label-dimmed)}
.wb-footer code{font-size:12px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:5px;padding:2px 5px}
.wb-followup-bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 14px;margin-bottom:18px;border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 30%,var(--dsw-alias-border-l1));border-radius:12px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 7%,var(--dsw-alias-bg-layer-1))}
.wb-followup-bar-text{flex:1;min-width:180px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.wb-followup-bar-title{font-weight:600;color:var(--dsw-alias-label-primary);display:block;margin-bottom:2px}
.wb-textarea{width:100%;min-height:118px;resize:vertical;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:10px 11px;font:inherit;font-size:12px;line-height:1.6;outline:none;transition:border-color .15s,box-shadow .15s}
.wb-textarea:focus{border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent)}
.wb-textarea::placeholder{color:var(--dsw-alias-label-dimmed)}
.wb-form-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:9px}
.wb-status-btns{display:flex;gap:6px;flex-wrap:wrap}
.wb-status-btn{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);border-radius:8px;padding:6px 9px;font:inherit;font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:5px}
.wb-status-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.wb-status-btn.on{border-color:color-mix(in srgb,var(--sc) 45%,transparent);background:color-mix(in srgb,var(--sc) 12%,transparent);color:var(--sc)}
.wb-meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--dsw-alias-border-l1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;overflow:hidden}
.wb-meta-cell{background:var(--dsw-alias-bg-layer-1);padding:9px 11px;min-width:0}
.wb-meta-key{font-size:12px;color:var(--dsw-alias-label-tertiary);letter-spacing:.4px;text-transform:uppercase}
.wb-meta-val{font-size:12px;margin-top:4px;color:var(--dsw-alias-label-primary);word-break:break-word;line-height:1.45}
.wb-tag-list{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}
.wb-save-state.ok{color:var(--dsw-alias-state-success-primary)}
.wb-sub-list{display:flex;flex-direction:column;gap:4px}
.wb-sub-row{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:8px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);cursor:pointer;font-size:12px;min-width:0}
.wb-sub-row:hover{border-color:var(--dsw-alias-border-l3)}
.wb-sub-row span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-sub-row small{margin-left:auto;color:var(--dsw-alias-label-tertiary);font-size:12px;white-space:nowrap}
.wb-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:950;background:var(--dsw-alias-bg-layer-3);border:1px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-primary);border-radius:10px;padding:9px 14px;font-size:12px;box-shadow:0 12px 40px color-mix(in srgb,#000 35%,transparent);animation:wb-toast .2s ease}
@keyframes wb-toast{from{opacity:0;transform:translate(-50%,6px)}to{opacity:1;transform:translate(-50%,0)}}
.wb-note-local{font-size:12px;color:var(--dsw-alias-label-dimmed);margin-top:6px}
/* Visual system pass, adapted from elayadesign/ai-design-skills
   (landing-page-design, MIT): one typeface, 4px spacing scale, 8/16px
   radii, flat surfaces, weighted motion, visible focus and full states.
   The landing page conversion structure does not apply to this tool. */
.wb-root{--wb-ease:cubic-bezier(.22,1,.36,1);background:var(--dsw-alias-bg-base);font-family:Geist,Manrope,"PingFang SC","Microsoft YaHei",system-ui,sans-serif}
.wb-header{background:color-mix(in srgb,var(--dsw-alias-bg-base) 92%,transparent)}
.wb-header-inner{padding:16px 24px}
.wb-brand-mark{border-radius:12px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent);box-shadow:none}
.wb-title{font-size:20px;line-height:28px;font-weight:600;letter-spacing:0}
.wb-subtitle{font-size:12px;line-height:16px;margin-top:4px}
.wb-scan-state{font-size:12px}
.wb-btn{border-radius:8px;padding:8px 12px;font-size:14px;line-height:20px;font-weight:600;transition:background-color 300ms var(--wb-ease),border-color 300ms var(--wb-ease),color 300ms var(--wb-ease),transform 300ms var(--wb-ease)}
.wb-btn:hover{transform:translateY(-1px)}
.wb-btn:active{transform:scale(.98)}
.wb-btn.icon{width:36px;height:36px;padding:8px}
.wb-main:focus-visible,.wb-btn:focus-visible,.wb-tab:focus-visible,.wb-input:focus-visible,.wb-select:focus-visible,.wb-textarea:focus-visible,.wb-card:focus-visible,.wb-row:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.wb-shell{padding:24px 24px 56px}
.wb-tab.active{background:var(--dsw-alias-interactive-bg-hover)}
.wb-tab.active::after{box-shadow:none}
.wb-tabs{gap:8px;margin-bottom:24px}
.wb-tab{font-size:14px;line-height:20px;padding:12px 16px;border-radius:8px 8px 0 0;transition:color 300ms var(--wb-ease),background-color 300ms var(--wb-ease)}
.wb-panel{border-radius:16px;background:var(--dsw-alias-bg-layer-1)}
.wb-panel-head{padding:16px 16px 12px}
.wb-panel-title{font-size:14px;line-height:20px;font-weight:600}
.wb-panel-sub{font-size:12px;line-height:16px;margin-top:4px}
.wb-panel-body{padding:0 16px 16px}
.wb-row{gap:12px;padding:12px 0}
.wb-rank{width:24px;font-size:12px}
.wb-row-name{font-size:14px;line-height:20px;font-weight:600}
.wb-row-meta{font-size:12px;line-height:16px;margin-top:4px}
.wb-row-right{font-size:12px}
.wb-status-pill{font-size:12px;padding:4px 8px;border-radius:8px;font-weight:600}
.wb-disk-fill,.wb-bar-fill{width:100%;height:100%;background:var(--dsw-alias-brand-primary);transform:scaleX(var(--wb-pct,0));transform-origin:left;transition:transform 500ms var(--wb-ease)}
.wb-disk-fill.warn{background:var(--dsw-alias-state-error-primary)}
.wb-tools{gap:12px;margin-bottom:12px}
.wb-tools.sub{margin-top:-4px;gap:16px}
.wb-tools.sub .wb-panel-sub{margin:0 0 0 auto;text-align:right;flex:0 1 auto}
.wb-check-group{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.wb-search{min-width:240px;max-width:420px}
.wb-input,.wb-select{border-radius:8px;padding:8px 12px;font-size:14px;line-height:20px;min-height:36px}
.wb-seg{border-radius:8px}
.wb-seg button{font-size:12px;padding:8px 12px}
.wb-check{font-size:12px}
.wb-grid{gap:16px;grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}
.wb-card{border-radius:16px;padding:16px;background:var(--dsw-alias-bg-layer-1);transition:border-color 300ms var(--wb-ease),transform 300ms var(--wb-ease),background-color 300ms var(--wb-ease)}
.wb-card:hover{transform:translateY(-2px)}
.wb-card::before{display:none}
.wb-card-name{font-size:16px;line-height:24px;font-weight:600}
.wb-card-note{font-size:12px;line-height:18px;margin-top:8px;-webkit-line-clamp:2;min-height:36px;text-wrap:pretty}
.wb-card-note.empty{font-style:normal}
.wb-card-meta{font-size:12px;gap:8px;margin-top:12px}
.wb-card-foot{margin-top:12px;padding-top:12px;gap:8px}
.wb-chip{font-size:12px;padding:4px 8px;border-radius:8px}
.wb-path{font-size:12px;color:var(--dsw-alias-label-dimmed);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;direction:ltr;text-align:right}
.wb-table-wrap{border-radius:16px;background:var(--dsw-alias-bg-layer-1)}
.wb-table{font-size:14px}
.wb-table th{font-size:12px;padding:12px 16px;font-weight:600;letter-spacing:0;text-transform:none}
.wb-table td{padding:12px 16px}
.wb-table .name{font-weight:600}
.wb-table .path{font-size:12px}
.wb-sw-grid{gap:16px}
.wb-sw-card{border-radius:16px;padding:16px;background:var(--dsw-alias-bg-layer-1)}
.wb-sw-name{font-size:14px;line-height:20px;font-weight:600}
.wb-sw-cat,.wb-sw-ver,.wb-sw-path,.wb-sw-foot{font-size:12px}
.wb-disk-grid{gap:16px;margin-bottom:24px}
.wb-disk-card{border-radius:16px;padding:16px;background:var(--dsw-alias-bg-layer-1)}
.wb-disk-letter{font-size:24px;line-height:32px;font-weight:600;letter-spacing:0}
.wb-disk-free,.wb-disk-cap{font-size:12px}
.wb-bars{gap:12px}
.wb-bar-row{font-size:12px;gap:12px}
.wb-bar-val{font-size:12px}
.wb-empty-title{font-size:14px;font-weight:600}
.wb-empty-sub{font-size:12px}
.wb-skeleton{border-radius:16px}
.wb-error{border-radius:16px;font-size:14px}
.wb-footer{font-size:12px}
.wb-footer code{font-size:12px}
.wb-textarea{min-height:128px;border-radius:8px;padding:12px;font-size:14px;line-height:20px}
.wb-status-btn{font-size:12px;padding:8px 12px;border-radius:8px}
.wb-meta-cell{padding:12px}
.wb-meta-key{font-size:12px;letter-spacing:0;text-transform:none}
.wb-meta-val{font-size:14px;line-height:20px}
.wb-sub-row{font-size:12px;padding:8px 12px;border-radius:8px}
.wb-toast{font-size:14px;border-radius:8px;padding:12px 16px;animation:wb-toast 300ms var(--wb-ease)}

/* Project runtime vocabulary: one visual language for every project kind. */
.wb-root{--wb-dur-fast:140ms;--wb-dur-base:220ms;--wb-dur-slow:320ms;--wb-ease-out:cubic-bezier(.2,0,0,1)}
.wb-rt-state{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:2px 7px;font-size:11px;line-height:16px;font-weight:600;white-space:nowrap;background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 70%,transparent);color:var(--dsw-alias-label-secondary)}
.wb-rt-state-dot{width:5px;height:5px;border-radius:50%;background:currentColor;display:inline-block;flex:0 0 auto}
.wb-rt-state.is-running{color:var(--dsw-alias-brand-primary);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 30%,transparent);background:color-mix(in srgb,var(--dsw-alias-brand-primary) 7%,transparent)}
.wb-rt-state.is-running:not(.is-stale) .wb-rt-state-dot{animation:wb-rt-heartbeat 2s var(--wb-ease-out) infinite}
.wb-rt-state.is-waiting{color:var(--dsw-alias-state-warn-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 30%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 7%,transparent)}
.wb-rt-state.is-blocked,.wb-rt-state.is-failed{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 30%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 7%,transparent)}
.wb-rt-state.is-done{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 30%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 7%,transparent)}
.wb-rt-state.is-unknown,.wb-rt-state.is-ready{color:var(--dsw-alias-label-tertiary)}
.wb-rt-state.is-stale{opacity:.72;filter:saturate(.55)}
.wb-rt-state-stale{font-weight:400;opacity:.8}
@keyframes wb-rt-heartbeat{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--dsw-alias-brand-primary) 0%,transparent)}45%{box-shadow:0 0 0 4px color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent);opacity:.7}60%{opacity:1}}
.wb-rt-mini{margin-top:9px;padding:8px 9px 7px;border:1px solid color-mix(in srgb,var(--dsw-alias-border-l1) 80%,transparent);border-radius:10px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 58%,transparent);min-width:0}
.wb-rt-mini-head{display:flex;align-items:center;gap:6px;min-width:0}
.wb-rt-mini-stage{font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.wb-rt-mini-pct{font-size:10px;line-height:14px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.wb-rt-track{display:flex;align-items:center;gap:4px;margin-top:7px}
.wb-rt-step{height:4px;flex:1;border-radius:3px;background:color-mix(in srgb,var(--dsw-alias-border-l2) 70%,transparent);overflow:hidden;transition:background var(--wb-dur-base) var(--wb-ease-out)}
.wb-rt-step i{display:block;height:100%;background:var(--dsw-alias-label-tertiary);transform-origin:left;transition:transform var(--wb-dur-slow) var(--wb-ease-out)}
.wb-rt-step.is-done{background:color-mix(in srgb,var(--dsw-alias-state-success-primary) 25%,transparent)}
.wb-rt-step.is-done i{background:var(--dsw-alias-state-success-primary);transform:scaleX(1)}
.wb-rt-step.is-running i{background:var(--dsw-alias-brand-primary);transform:scaleX(.62);animation:wb-rt-step-breathe 2.4s var(--wb-ease-out) infinite}
.wb-rt-step.is-failed i,.wb-rt-step.is-blocked i{background:var(--dsw-alias-state-error-primary);transform:scaleX(1)}
.wb-rt-step.is-current{box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-brand-primary) 35%,transparent)}
@keyframes wb-rt-step-breathe{0%,100%{opacity:.75}50%{opacity:1}}
.wb-rt-mini-latest{display:flex;align-items:center;gap:6px;margin-top:7px;min-width:0;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:14px}
.wb-rt-mini-latest img{width:22px;height:22px;border-radius:5px;object-fit:cover;flex:0 0 auto;background:var(--dsw-alias-bg-layer-3)}
.wb-rt-mini-art-icon{width:22px;height:22px;border-radius:5px;display:grid;place-items:center;background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-tertiary);flex:0 0 auto}
.wb-rt-mini-art-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;color:var(--dsw-alias-label-secondary)}
.wb-rt-mini-art-time{flex:0 0 auto}

@media (prefers-reduced-motion:reduce){.wb-root *,.wb-root *::before,.wb-root *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
@media (max-width:1320px){.wb-tools{gap:8px}.wb-search{min-width:170px}.wb-select{padding-left:9px;padding-right:24px}.wb-seg button{padding:8px 9px}}
.wb-earth{position:relative;border-top:1px solid var(--dsw-alias-border-l1);border-bottom:1px solid var(--dsw-alias-border-l1);background:#03080e;color:#edf3f5;isolation:isolate}
.wb-earth-stage{position:relative;min-height:680px;height:calc(100vh - 380px);max-height:760px;overflow:hidden;background:radial-gradient(ellipse at 72% 38%,#0b1a27 0%,#040a11 42%,#010407 100%);isolation:isolate;cursor:grab}
.wb-earth-stage.is-panorama{position:fixed;inset:0;z-index:90;min-height:100vh;border:0;background:#010407}
.wb-earth.is-panorama{transform:none!important;animation:none!important}
body.wb-earth-panorama .u_dock{opacity:0!important;visibility:hidden!important;pointer-events:none!important}
.wb-earth-stars{position:absolute;inset:0;z-index:0;pointer-events:none;background-image:radial-gradient(circle at 12% 18%,rgba(226,239,247,.72) 0 1px,transparent 1.6px),radial-gradient(circle at 73% 24%,rgba(205,226,240,.5) 0 1px,transparent 1.5px),radial-gradient(circle at 43% 78%,rgba(220,235,245,.42) 0 1px,transparent 1.5px),radial-gradient(circle at 88% 67%,rgba(212,230,242,.6) 0 1px,transparent 1.6px),radial-gradient(circle at 27% 58%,rgba(210,226,238,.34) 0 1px,transparent 1.5px),radial-gradient(circle at 62% 12%,rgba(230,240,248,.5) 0 1px,transparent 1.5px),radial-gradient(circle at 8% 86%,rgba(220,234,244,.45) 0 1px,transparent 1.5px);background-size:37% 43%,51% 61%,43% 57%,67% 53%,59% 49%,71% 43%,47% 59%;opacity:.65}
.wb-earth-canvas{position:absolute;inset:0;z-index:1;display:block;width:100%;height:100%;touch-action:none;outline:none}
.wb-earth-markers{position:absolute;inset:0;z-index:3;pointer-events:none}
.wb-earth-marker{position:absolute;left:0;top:0;appearance:none;border:0;background:none;color:#f3f6f7;padding:6px 8px;margin:0;display:flex;align-items:center;gap:7px;transform:translate3d(-40px,-40px,0);transition:opacity .2s ease;pointer-events:auto;cursor:pointer;white-space:nowrap;font:inherit;text-align:left}
.wb-earth-dot{display:block;width:5px;height:5px;border-radius:50%;background:#f3d9b6;box-shadow:0 0 0 3px rgba(243,217,182,.13),0 0 14px rgba(243,217,182,.45);flex:0 0 auto;transition:width .18s ease,height .18s ease,box-shadow .18s ease}
.wb-earth-label{display:none;font-size:11px;line-height:14px;letter-spacing:.01em;color:rgba(239,244,246,.78);text-shadow:0 1px 8px #02060a,0 0 2px #02060a;max-width:145px;overflow:hidden;text-overflow:ellipsis}
.wb-earth-marker.is-labeled .wb-earth-label{display:block}
.wb-earth-marker.is-active{z-index:50!important}
.wb-earth-marker.is-active .wb-earth-dot{width:7px;height:7px;background:#fff2dc;box-shadow:0 0 0 4px rgba(255,242,220,.17),0 0 24px rgba(255,210,154,.7)}
.wb-earth-marker.is-active .wb-earth-label{display:block;color:#fffaf1;font-size:12px;max-width:190px}
.wb-earth-marker.is-preview{z-index:45!important}
.wb-earth-marker.is-preview .wb-earth-dot{width:7px;height:7px;background:#fff2dc;box-shadow:0 0 0 4px rgba(255,242,220,.16),0 0 22px rgba(255,210,154,.64)}
.wb-earth-marker.is-preview .wb-earth-label{display:block;color:#fff;font-size:12px;max-width:190px}
.wb-earth-marker.is-label-up .wb-earth-label{transform:translateY(-20px)}
.wb-earth-marker.is-label-down .wb-earth-label{transform:translateY(20px)}
.wb-earth-marker:hover .wb-earth-label,.wb-earth-marker:focus-visible .wb-earth-label{display:block;color:#fff}
.wb-earth-marker:focus-visible{outline:1px solid rgba(255,242,220,.7);outline-offset:3px;border-radius:2px}
.wb-earth-top{position:absolute;z-index:8;left:26px;right:26px;top:22px;display:flex;align-items:center;justify-content:space-between;gap:18px;pointer-events:none}
.wb-earth-brand{display:flex;align-items:center;gap:10px;min-width:0;pointer-events:auto}
.wb-earth-mark{width:29px;height:29px;display:grid;place-items:center;border:1px solid rgba(224,236,241,.32);border-radius:50%;color:#e7f0f3}
.wb-earth-brand>span:nth-child(2){font-size:13px;font-weight:600;letter-spacing:.02em;white-space:nowrap}
.wb-earth-divider{width:1px;height:14px;background:rgba(220,234,241,.22)}
.wb-earth-caption{font-size:10px;color:rgba(215,228,234,.56);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-earth-scenes{display:flex;justify-content:center;flex:1 1 auto;min-width:0;pointer-events:auto}
.wb-earth-actions{display:flex;align-items:center;gap:8px;pointer-events:auto;flex:0 0 auto}
.wb-earth-clock{font-size:9px;letter-spacing:.11em;text-transform:uppercase;color:rgba(210,227,235,.55);font-variant-numeric:tabular-nums;margin-right:5px;white-space:nowrap}
.wb-earth-control{appearance:none;border:1px solid rgba(210,229,238,.22);background:rgba(4,13,20,.28);color:rgba(235,243,246,.78);border-radius:999px;font:inherit;font-size:10px;line-height:20px;padding:5px 10px;min-height:30px;cursor:pointer;transition:border-color .2s ease,color .2s ease,background .2s ease}
.wb-earth-control:hover,.wb-earth-control:focus-visible{border-color:rgba(239,247,249,.52);color:#fff;outline:none}
.wb-earth-control.is-on{border-color:rgba(235,201,158,.62);color:#f6e3c8;background:rgba(73,52,29,.18)}
.wb-earth-intro{position:absolute;z-index:5;left:30px;top:104px;max-width:330px;pointer-events:none}
.wb-earth-intro{transition:opacity .45s var(--wb-ease),transform .45s var(--wb-ease)}
.wb-earth.is-flight .wb-earth-intro,.wb-earth-stage.is-active .wb-earth-intro{opacity:0;transform:translateY(-10px);pointer-events:none}
.wb-earth.is-flight .wb-earth-inspector{opacity:0;transform:translateX(8px);pointer-events:none}
.wb-earth.is-flight .wb-earth-marker{opacity:0!important;pointer-events:none!important;transition:opacity .24s ease}
.wb-earth.is-landing .wb-earth-inspector{right:22px;top:92px;width:318px;max-height:calc(100% - 116px);padding:20px 20px 0;border-left:1px solid rgba(243,217,182,.38);background:linear-gradient(180deg,rgba(5,14,20,.9),rgba(4,12,17,.96));box-shadow:-22px 0 48px rgba(0,0,0,.28)}
.wb-earth.is-landing .wb-earth-inspector h2{font-size:27px}
.wb-earth.is-landing .wb-earth-inspector.is-map-card{right:auto;border:1px solid rgba(243,217,182,.3);border-radius:18px;padding:16px 17px 14px;background:linear-gradient(158deg,rgba(9,23,31,.97),rgba(3,10,15,.985));box-shadow:0 30px 76px rgba(0,0,0,.58),inset 0 1px 0 rgba(255,255,255,.06);backdrop-filter:blur(18px);overflow:visible;animation:wb-earth-card-in .36s var(--wb-ease-out) both}
.wb-earth.is-landing .wb-earth-inspector.is-map-card .wb-anchor-record,.wb-earth.is-landing .wb-earth-inspector.is-map-card .wb-earth-note,.wb-earth.is-landing .wb-earth-inspector.is-map-card .wb-anchor-links,.wb-earth.is-landing .wb-earth-inspector.is-map-card .wb-earth-disclaimer{display:none}
.wb-earth.is-landing .wb-earth-inspector.is-map-card::before{content:"";position:absolute;inset:0;border-radius:inherit;background:radial-gradient(120% 72% at 0 0,rgba(243,217,182,.09),transparent 56%);pointer-events:none}
.wb-earth.is-landing .wb-earth-inspector.is-map-card h2{font-size:24px;margin-top:7px}
.wb-earth.is-landing .wb-earth-inspector.is-map-card .wb-anchor-media-button{max-width:none;margin-top:2px}
.wb-earth-card-head{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:10px}
.wb-earth-card-head .wb-earth-overline{margin:0}
.wb-earth-card-close{appearance:none;flex:0 0 auto;width:24px;height:24px;border:1px solid rgba(213,231,238,.18);border-radius:50%;background:rgba(213,231,238,.05);color:rgba(232,242,245,.7);font:inherit;font-size:16px;line-height:20px;cursor:pointer;padding:0;transition:border-color .18s ease,color .18s ease,background .18s ease}
.wb-earth-card-close:hover,.wb-earth-card-close:focus-visible{border-color:rgba(243,217,182,.56);color:#f6e4c9;background:rgba(243,217,182,.08);outline:none}
.wb-earth-card-actions{position:relative;z-index:1;display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin:13px 0 3px;padding:12px 0;border-top:1px solid rgba(218,234,240,.12);border-bottom:1px solid rgba(218,234,240,.12)}
.wb-earth-card-actions .wb-btn{font-size:11px;padding:7px 10px}
.wb-earth-anchor-editor{position:absolute;z-index:30;box-sizing:border-box;left:18px;top:68px;width:min(310px,calc(100% - 36px));max-height:calc(100% - 86px);overflow:auto;padding:14px;border:1px solid rgba(221,235,240,.3);border-radius:14px;background:rgba(5,16,23,.97);box-shadow:0 18px 48px rgba(0,0,0,.48);color:#edf5f7}
.wb-earth-anchor-editor h3{margin:0 0 6px;font-size:15px}.wb-earth-anchor-editor p{margin:0 0 10px;color:rgba(225,238,242,.75);font-size:11px;line-height:1.5}
.wb-earth-anchor-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.wb-earth-anchor-fields label{display:flex;min-width:0;flex-direction:column;gap:4px;color:rgba(225,238,242,.8);font-size:10px}.wb-earth-anchor-fields input{width:100%;min-width:0;box-sizing:border-box;min-height:44px;border:1px solid rgba(220,234,240,.28);border-radius:6px;background:#101e26;color:#fff;padding:8px;font:inherit;font-size:16px}
.wb-earth-anchor-controls{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.wb-earth-anchor-controls .wb-btn{min-height:44px}.wb-earth-anchor-editor .is-error{color:#ffb6a8}.wb-earth-anchor-editor .is-status{color:#e9d6ac}
.wb-earth.is-anchor-picking .wb-earth-canvas{cursor:crosshair}.wb-earth.is-anchor-editing .wb-earth-markers{pointer-events:none}.wb-earth.is-anchor-editing .wb-earth-marker{pointer-events:none!important}
.wb-earth.is-anchor-editing .wb-earth-inspector{display:none}
.wb-earth.is-anchor-editing .wb-earth-marker.is-active{visibility:hidden}
.wb-earth-anchor-preview{position:absolute;z-index:16;left:0;top:0;pointer-events:none;display:flex;align-items:center;gap:5px;color:#fff;font-size:11px;text-shadow:0 1px 5px #000;white-space:nowrap}
.wb-earth-anchor-preview::before{content:"";box-sizing:content-box;width:12px;height:12px;flex:none;border:2px solid #fff;border-radius:50%;background:#74c2f5;box-shadow:0 0 0 5px rgba(116,194,245,.3),0 0 18px #74c2f5}
@media(max-width:640px){.wb-earth-anchor-editor{top:auto;bottom:12px;left:10px;width:calc(100% - 20px);max-height:48%;padding:10px}.wb-earth-anchor-editor p{font-size:11px}.wb-earth-anchor-controls{gap:5px;margin-top:7px}}
@container wb-workbench (max-width:600px){.wb-earth-anchor-editor{top:auto;bottom:12px;left:10px;width:calc(100% - 20px);max-height:48%;padding:10px}}
.wb-earth-card-hint{flex-basis:100%;font-size:8.5px;line-height:14px;color:rgba(203,221,229,.46);letter-spacing:.02em}
.wb-earth-card-tail{display:none;position:absolute;z-index:0;top:var(--wb-card-tail,50%);width:13px;height:13px;background:#07151d;border:1px solid rgba(243,217,182,.3);transform:rotate(45deg);pointer-events:none}
.wb-earth.is-landing .wb-earth-inspector.is-map-card[data-card-side="left"] .wb-earth-card-tail{display:block;right:-7px;border-left:0;border-bottom:0}
.wb-earth.is-landing .wb-earth-inspector.is-map-card[data-card-side="right"] .wb-earth-card-tail{display:block;left:-7px;border-right:0;border-top:0}
@keyframes wb-earth-card-in{from{opacity:0;transform:translateY(12px) scale(.975)}to{opacity:1;transform:none}}
.wb-earth.is-landing .wb-earth-marker:not(.is-active){opacity:0!important;pointer-events:none!important}
.wb-earth.is-landing .wb-earth-zoombar{display:none}
.wb-earth-landing-note{position:absolute;z-index:9;left:28px;top:92px;display:flex;align-items:flex-start;gap:9px;max-width:360px;padding:10px 12px;background:linear-gradient(90deg,rgba(4,12,18,.8),rgba(4,12,18,.38));border-left:1px solid rgba(243,217,182,.55);pointer-events:none}
.wb-earth-landing-dot{width:5px;height:5px;border-radius:50%;background:#f3d9b6;box-shadow:0 0 10px rgba(243,217,182,.65);margin-top:5px;flex:0 0 auto}
.wb-earth-landing-note b{display:block;font-size:9px;line-height:15px;letter-spacing:.13em;text-transform:uppercase;color:#f3d9b6}
.wb-earth-landing-note span{display:block;font-size:12px;line-height:18px;color:#f4f7f8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-earth-landing-note small{display:block;margin-top:3px;font-size:9px;line-height:15px;color:rgba(213,229,235,.58);text-wrap:pretty}
.wb-earth-intro h1{font-size:clamp(24px,3vw,38px);line-height:1.16;font-weight:500;letter-spacing:-.035em;margin:10px 0 10px;color:#f2f6f7;max-width:310px;text-wrap:balance}
.wb-earth-intro p{margin:0;max-width:290px;font-size:11px;line-height:1.75;color:rgba(212,228,235,.58);text-wrap:pretty}
.wb-earth-index{position:absolute;z-index:20;right:26px;top:104px;width:326px;max-height:calc(100% - 154px);display:flex;flex-direction:column;background:linear-gradient(180deg,rgba(6,17,25,.94),rgba(4,12,18,.88));border:1px solid rgba(213,231,238,.12);border-left:2px solid rgba(243,217,182,.34);border-radius:3px;padding:13px 14px 11px;backdrop-filter:blur(14px);box-shadow:0 18px 46px rgba(0,0,0,.32)}
.wb-earth-canvas,.wb-earth-markers{transform-origin:50% 50%;transition:transform .55s var(--wb-ease-out)}
.wb-earth.is-panorama .wb-earth-canvas,.wb-earth.is-panorama .wb-earth-markers{transition:none}
@media (min-width:981px) and (max-width:1360px){.wb-earth.is-index-open .wb-earth-index{right:18px;width:304px}.wb-earth.is-index-open .wb-earth-canvas,.wb-earth.is-index-open .wb-earth-markers{transform:translateX(-84px) scale(.93)}}
@media (min-width:981px) and (max-width:1180px){.wb-earth.is-index-open .wb-earth-index{right:14px}.wb-earth.is-index-open .wb-earth-intro{opacity:0;visibility:hidden;pointer-events:none}.wb-earth.is-index-open .wb-earth-canvas,.wb-earth.is-index-open .wb-earth-markers{transform:translateX(-145px) scale(.78)}}
.wb-earth-index-head{display:flex;align-items:center;gap:8px;min-width:0}
.wb-earth-index-heading{display:flex;flex-direction:column;gap:2px;min-width:0}
.wb-earth-index-head b{font-size:12px;font-weight:600;letter-spacing:.02em;white-space:nowrap}
.wb-earth-index-heading span{font-size:8px;line-height:11px;color:rgba(210,226,234,.46);white-space:nowrap}
.wb-earth-index-hint{margin-left:auto;font-size:7px;line-height:11px;letter-spacing:.02em;color:rgba(243,217,182,.62);white-space:nowrap}
.wb-earth-close{margin-left:auto;appearance:none;border:0;background:none;color:rgba(230,240,244,.62);font-size:18px;line-height:20px;cursor:pointer;padding:0 2px}
.wb-earth-close:hover{color:#fff}
.wb-earth-search{appearance:none;width:100%;margin:11px 0 9px;background:rgba(213,231,238,.06);border:1px solid rgba(213,231,238,.18);border-radius:3px;color:#eef5f7;font:inherit;font-size:10px;line-height:18px;padding:6px 8px;outline:none}
.wb-earth-search:focus{border-color:rgba(243,217,182,.55)}
.wb-earth-index-list{overflow:auto;overflow-x:hidden;min-height:0;padding:2px 4px 4px 0;display:grid;gap:7px;align-content:start;scrollbar-width:thin}
.wb-earth-project-card{--wb-card-accent:rgba(201,191,218,.72);position:relative;appearance:none;display:flex;flex-direction:column;gap:2px;box-sizing:border-box;width:100%;min-width:0;min-height:76px;text-align:left;border:1px solid rgba(213,231,238,.12);border-left:2px solid var(--wb-card-accent);border-radius:3px;background:linear-gradient(135deg,rgba(213,231,238,.055),rgba(4,12,18,.14));color:#eaf3f6;padding:8px 9px 7px;cursor:pointer;font:inherit;transition:transform .18s var(--wb-ease),border-color .18s var(--wb-ease),background .18s var(--wb-ease),box-shadow .18s var(--wb-ease)}
.wb-earth-project-card:hover,.wb-earth-project-card:focus-visible{transform:translateX(-2px);border-color:rgba(243,217,182,.42);background:linear-gradient(135deg,rgba(243,217,182,.1),rgba(4,12,18,.18));box-shadow:0 8px 18px rgba(0,0,0,.22);outline:none}
.wb-earth-project-card.is-active{border-color:rgba(243,217,182,.6);background:linear-gradient(135deg,rgba(243,217,182,.14),rgba(4,12,18,.2))}
.wb-earth-project-card.is-persistent{--wb-card-accent:#e8bd8e}
.wb-earth-project-card.is-incubating{--wb-card-accent:#b8c8ee}
.wb-earth-project-card.is-temporary{--wb-card-accent:#a7d2c1}
.wb-earth-project-card.is-unclassified{--wb-card-accent:#c9bfda}
.wb-earth-project-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}
.wb-earth-project-card-no{font-family:var(--wb-mono,ui-monospace,SFMono-Regular,Consolas,monospace);font-size:8px;line-height:11px;letter-spacing:.12em;color:rgba(213,231,238,.42)}
.wb-earth-project-card-life{font-size:8px;line-height:11px;letter-spacing:.04em;color:var(--wb-card-accent);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-earth-project-card-name{display:block;max-width:100%;font-size:13px;line-height:18px;font-weight:500;letter-spacing:-.01em;color:#f0f6f8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-earth-project-card-path{display:block;max-width:100%;font-size:8px;line-height:12px;color:rgba(203,221,229,.42);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-earth-project-card-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:2px;font-size:8px;line-height:12px;color:rgba(203,221,229,.5);white-space:nowrap;overflow:hidden}
.wb-earth-project-card-foot span{overflow:hidden;text-overflow:ellipsis}
.wb-earth-project-card-foot b{flex:0 0 auto;font-size:8px;font-weight:500;color:#f1d6ad;letter-spacing:.02em}
.wb-earth-index-empty{font-size:11px;color:rgba(203,221,229,.5);padding:14px 4px}
.wb-earth-inspector{position:absolute;z-index:7;right:26px;top:104px;width:270px;max-height:calc(100% - 128px);overflow-y:auto;scrollbar-width:thin;padding:0 4px 12px 16px;border-left:1px solid rgba(218,234,240,.2);pointer-events:auto;transition:opacity .3s var(--wb-ease),transform .3s var(--wb-ease)}
.wb-earth-inspector .wb-earth-actions-row{position:sticky;bottom:0;z-index:2;margin:10px 0 0;padding:10px 0 12px;background:linear-gradient(180deg,transparent 0,color-mix(in srgb,var(--dsw-alias-bg-base) 86%,#041018) 32%)}
.wb-earth-inspector h2{font-size:20px;line-height:1.25;font-weight:500;letter-spacing:-.025em;margin:8px 0 7px;color:#f4f7f8;text-wrap:balance}
.wb-earth-path{margin:0 0 13px;font-size:9px;line-height:15px;color:rgba(201,220,229,.48);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb-earth-facts{display:flex;flex-wrap:wrap;gap:5px 10px;padding:9px 0;border-top:1px solid rgba(218,234,240,.13);border-bottom:1px solid rgba(218,234,240,.13)}
.wb-earth-fact{font-size:9px;line-height:14px;color:rgba(213,229,235,.6);white-space:nowrap}
.wb-earth-fact.is-life{color:#f1d6ad}
.wb-earth-fact.is-life.is-persistent{color:#f1c79d}.wb-earth-fact.is-life.is-incubating{color:#b8c8ee}.wb-earth-fact.is-life.is-temporary{color:#a7d2c1}.wb-earth-fact.is-life.is-unclassified{color:#c9bfda}
.wb-earth-note{margin:12px 0 14px;font-size:11px;line-height:1.7;color:rgba(218,232,237,.62);display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;text-wrap:pretty}
.wb-earth-actions-row{display:flex;flex-wrap:wrap;gap:8px}
.wb-earth-actions-row .wb-btn{font-size:11px;padding:7px 10px}
.wb-earth-wheel-hint{flex-basis:100%;font-size:9px;letter-spacing:.02em;color:var(--dsw-alias-label-tertiary);opacity:.82;padding-top:2px}
.wb-earth-disclaimer{font-size:8px;line-height:14px;letter-spacing:.04em;color:rgba(196,215,223,.38);margin:12px 0 0}
.wb-earth-inspector.is-empty{max-width:230px}
.wb-earth-empty-copy{font-size:11px;line-height:1.8;color:rgba(207,224,231,.52);margin:10px 0 0}
.wb-earth-zoombar{position:absolute;z-index:8;right:26px;bottom:52px;display:flex;flex-direction:column;border-top:1px solid rgba(218,234,240,.2);border-bottom:1px solid rgba(218,234,240,.2)}
.wb-earth-zoombar button{appearance:none;width:30px;height:30px;border:0;border-bottom:1px solid rgba(218,234,240,.12);background:rgba(4,13,20,.3);color:rgba(235,243,246,.75);font-size:16px;line-height:24px;cursor:pointer}
.wb-earth-zoombar button:last-child{border-bottom:0}
.wb-earth-zoombar button:hover{color:#fff;background:rgba(243,217,182,.09)}
.wb-earth-bottom{position:absolute;z-index:6;left:28px;right:28px;bottom:19px;display:flex;align-items:center;gap:18px;font-size:8px;line-height:14px;letter-spacing:.06em;color:rgba(200,219,227,.42);pointer-events:none}
.wb-earth-bottom span{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.wb-earth-live-dot{display:inline-block;width:4px;height:4px;border-radius:50%;background:#e9cba1;box-shadow:0 0 8px rgba(233,203,161,.7)}
.wb-earth-flight{position:absolute;z-index:25;left:50%;bottom:46px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;font-size:10px;letter-spacing:.04em;color:rgba(240,245,246,.8);background:rgba(3,10,15,.55);padding:7px 12px;border-top:1px solid rgba(243,217,182,.35)}
.wb-earth-flight-dot{width:4px;height:4px;border-radius:50%;background:#f3d9b6;animation:wb-earth-breathe 1.2s ease-in-out infinite}
.wb-earth-touchdown{position:absolute;z-index:26;left:50%;bottom:56px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:4px;min-width:250px;padding:12px 20px 14px;background:linear-gradient(180deg,rgba(5,16,22,.88),rgba(3,9,14,.94));border:1px solid rgba(243,217,182,.28);border-top-color:rgba(243,217,182,.52);box-shadow:0 18px 55px rgba(0,0,0,.5),0 0 30px rgba(243,217,182,.06);backdrop-filter:blur(16px);pointer-events:none;animation:wb-touchdown-in .34s cubic-bezier(.2,0,0,1) both}
.wb-earth-touchdown-kicker{font-size:8px;letter-spacing:.16em;color:rgba(243,217,182,.72)}
.wb-earth-touchdown b{font-size:15px;font-weight:560;color:#fffaf1;letter-spacing:-.01em}
.wb-earth-touchdown-hint{font-size:10px;color:rgba(213,228,234,.58)}
.wb-earth-touchdown-progress{position:absolute;left:0;right:0;bottom:0;display:block;height:1px;background:linear-gradient(90deg,rgba(243,217,182,.18),#f3d9b6);transform-origin:left;animation:wb-touchdown-progress .9s linear both}
.wb-earth.is-touchdown .wb-earth-marker.is-active{opacity:1!important;pointer-events:none!important;z-index:46!important}
.wb-earth.is-touchdown .wb-earth-marker.is-active .wb-earth-label{display:block!important;color:#fffaf1}
.wb-earth.is-touchdown .wb-earth-marker.is-active .wb-earth-dot{box-shadow:0 0 0 7px rgba(255,242,220,.18),0 0 30px rgba(255,210,154,.8)}
.wb-earth-marker.is-arrival{z-index:47!important}
.wb-earth-marker.is-arrival .wb-earth-dot{width:8px;height:8px;background:#fff2dc;box-shadow:0 0 0 7px rgba(255,242,220,.2),0 0 34px rgba(255,210,154,.9)}
.wb-earth-marker.is-arrival .wb-earth-label{display:block;color:#fffaf1;font-size:12px;max-width:190px}
.wb-earth.is-touchdown .wb-earth-marker.is-arrival{opacity:1!important;pointer-events:none!important}
.wb-earth.is-touchdown .wb-earth-marker.is-arrival .wb-earth-label{display:block!important}
@keyframes wb-touchdown-in{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes wb-touchdown-progress{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes wb-earth-breathe{0%,100%{opacity:.35}50%{opacity:1}}
.wb-earth-credit{padding:8px 26px 9px;background:#020609;font-size:8px;line-height:14px;letter-spacing:.03em;color:rgba(191,211,220,.35);border-top:1px solid rgba(210,229,237,.07)}
.wb-earth-fallback{padding-top:16px;border-top:1px solid var(--dsw-alias-border-l1)}
.wb-earth-fallback-head{display:flex;align-items:flex-start;gap:10px;padding:0 2px 14px;color:var(--dsw-alias-label-secondary)}
.wb-earth-fallback-head b{display:block;font-size:13px;color:var(--dsw-alias-label-primary);margin-bottom:3px}
.wb-earth-fallback-head p{margin:0;font-size:11px;line-height:1.7;max-width:760px}
.wb-earth.is-panorama .wb-earth-intro,.wb-earth-stage.is-panorama .wb-earth-intro,.wb-earth-stage.is-panorama .wb-earth-inspector,.wb-earth-stage.is-panorama .wb-earth-bottom,.wb-earth-stage.is-panorama .wb-earth-zoombar,.wb-earth-stage.is-panorama .wb-earth-top .wb-earth-brand,.wb-earth-stage.is-panorama .wb-earth-top .wb-earth-actions .wb-earth-clock{opacity:0;pointer-events:none;transition:opacity .25s ease}
.wb-earth-stage.is-panorama .wb-earth-inspector{display:none!important}
.wb-earth-stage.is-panorama .wb-earth-marker .wb-earth-label{display:none!important}
.wb-earth-stage.is-panorama .wb-earth-marker:hover .wb-earth-label,.wb-earth-stage.is-panorama .wb-earth-marker:focus-visible .wb-earth-label,.wb-earth-stage.is-panorama .wb-earth-marker.is-preview .wb-earth-label{display:block!important}
.wb-earth-stage.is-panorama .wb-earth-landing-note{display:none!important}
.wb-earth-stage.is-panorama .wb-earth-top{opacity:0;pointer-events:none}
.wb-earth-stage.is-panorama .wb-earth-credit{display:none}
.wb-earth-stage.is-panorama .wb-earth-canvas{cursor:default}
.wb-earth-stage.is-panorama .wb-earth-index.is-deck{left:24px;right:24px;top:auto;bottom:24px;width:auto;max-height:min(300px,calc(100vh - 120px));padding:13px 16px 14px;border:1px solid rgba(213,231,238,.17);border-left:1px solid rgba(213,231,238,.17);border-radius:16px;background:linear-gradient(180deg,rgba(5,15,21,.93),rgba(3,9,14,.97));box-shadow:0 22px 70px rgba(0,0,0,.55);backdrop-filter:blur(18px)}
.wb-earth-stage.is-panorama .wb-earth-index.is-deck .wb-earth-index-list{display:flex;gap:10px;overflow-x:auto;overflow-y:hidden;padding:4px 2px 8px;scrollbar-width:none}
.wb-earth-stage.is-panorama .wb-earth-index.is-deck .wb-earth-index-list::-webkit-scrollbar{display:none}
.wb-earth-stage.is-panorama .wb-earth-project-card{flex:0 0 222px;width:222px;min-height:108px}
.wb-earth-stage.is-panorama .wb-earth-project-card-name{font-size:12px}
.wb-earth-restore{position:absolute;z-index:31;right:26px;top:20px;appearance:none;border:1px solid rgba(213,231,238,.22);border-radius:999px;background:rgba(3,10,15,.66);color:rgba(240,246,248,.72);padding:6px 11px;font:inherit;font-size:9px;line-height:12px;letter-spacing:.04em;cursor:pointer;backdrop-filter:blur(8px);transition:color .2s ease,border-color .2s ease,background .2s ease}
.wb-earth-restore:hover{color:#fff;border-color:rgba(243,217,182,.6);background:rgba(22,17,10,.72)}
.wb-anchor-media{margin:11px 0 10px}
.wb-anchor-media-button{position:relative;display:block;width:100%;aspect-ratio:16/9;overflow:hidden;border:1px solid rgba(217,234,240,.2);background:rgba(3,10,15,.5);cursor:pointer;padding:0;text-align:left}
.wb-anchor-media-button:focus-visible{outline:2px solid rgba(236,203,161,.72);outline-offset:2px}
.wb-anchor-media-image{width:100%;height:100%;object-fit:cover;display:block;filter:saturate(.9) contrast(1.03)}
.wb-anchor-media-shade{position:absolute;inset:0;background:linear-gradient(180deg,transparent 46%,rgba(2,8,12,.78) 100%);pointer-events:none}
.wb-anchor-media-caption{position:absolute;left:9px;bottom:8px;font-size:9px;letter-spacing:.03em;color:#f1e5d3}
.wb-anchor-media-change{position:absolute;right:7px;top:7px;z-index:1;padding:3px 7px;border:1px solid rgba(232,241,244,.26);background:rgba(3,10,14,.64);color:rgba(236,244,246,.8);font:inherit;font-size:8px;cursor:pointer;backdrop-filter:blur(5px)}
.wb-anchor-media-empty{display:flex;flex-direction:column;gap:5px;align-items:flex-start;width:100%;min-height:84px;padding:11px;border:1px dashed rgba(215,233,239,.24);background:rgba(4,12,17,.34);color:rgba(216,232,238,.62);font:inherit;font-size:9px;line-height:1.5;text-align:left;cursor:pointer}
.wb-anchor-media-empty b{color:#ead6b8;font-size:9px;letter-spacing:.03em}
.wb-anchor-media-empty:hover{border-color:rgba(229,196,153,.52)}
.wb-anchor-media-meta{display:flex;flex-wrap:wrap;gap:3px 8px;margin-top:5px;font-size:7px;line-height:1.5;letter-spacing:.04em;color:rgba(197,219,227,.46)}
.wb-anchor-media-meta .is-pinned{color:#d9bd92}
.wb-anchor-warning{margin:4px 0 0;font-size:8px;line-height:1.5;color:#d9b38c}
.wb-anchor-record{display:flex;flex-direction:column;gap:2px;margin:8px 0 8px;padding-top:7px;border-top:1px solid rgba(215,233,239,.13)}
.wb-anchor-record span{font-size:7px;letter-spacing:.1em;text-transform:uppercase;color:rgba(196,219,227,.42)}
.wb-anchor-record b{font-size:10px;font-weight:500;color:rgba(236,244,246,.83)}
.wb-anchor-record small{font-size:7px;line-height:1.5;color:rgba(196,219,227,.4)}
.wb-anchor-links{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 9px}
.wb-anchor-links button{border:1px solid rgba(212,231,238,.17);background:rgba(6,17,23,.36);color:rgba(225,238,242,.7);padding:4px 7px;font:inherit;font-size:8px;cursor:pointer}
.wb-anchor-links button:hover{border-color:rgba(232,199,158,.45);color:#efdfc8}
.wb-media-missing{display:grid;place-items:center;width:100%;height:100%;min-height:64px;background:rgba(4,12,16,.72);color:rgba(206,225,232,.38)}
.wb-media-overlay{position:fixed;inset:0;z-index:120;display:grid;place-items:center;padding:24px;background:rgba(1,6,9,.76);backdrop-filter:blur(12px)}
.wb-media-picker{width:min(920px,96vw);max-height:88vh;overflow:auto;background:linear-gradient(180deg,#07151d,#040c12);border:1px solid rgba(216,234,240,.2);box-shadow:0 28px 100px rgba(0,0,0,.62);padding:19px 20px 15px;color:#e7f0f2}
.wb-media-picker-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}
.wb-media-picker-head h2{margin:6px 0 5px;font-size:23px;font-weight:500;letter-spacing:-.03em}
.wb-media-picker-head p{margin:0;max-width:620px;font-size:10px;line-height:1.7;color:rgba(209,228,235,.56)}
.wb-media-close{border:0;background:transparent;color:rgba(226,239,243,.65);font-size:24px;line-height:1;cursor:pointer;padding:2px 5px}
.wb-media-picker-status{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:13px 0 8px;padding-top:8px;border-top:1px solid rgba(214,233,240,.13);font-size:8px;letter-spacing:.05em;color:rgba(198,220,228,.5)}
.wb-media-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:9px 0 14px}
.wb-media-cell{position:relative;display:flex;flex-direction:column;align-items:stretch;gap:4px;padding:0;border:1px solid rgba(214,233,240,.14);background:rgba(5,15,21,.6);color:inherit;text-align:left;cursor:pointer;overflow:hidden}
.wb-media-cell:hover,.wb-media-cell.is-pinned{border-color:rgba(232,198,156,.56)}
.wb-media-cell.is-pinned{box-shadow:0 0 0 1px rgba(232,198,156,.3) inset}
.wb-media-cell-image{display:block;width:100%;aspect-ratio:16/10;object-fit:cover;background:#061018}
.wb-media-cell-name{padding:0 6px;font-size:8px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:rgba(235,244,246,.84)}
.wb-media-cell-meta{padding:0 6px 5px;font-size:6px;line-height:1.35;color:rgba(197,219,227,.42);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-media-cell-pin{position:absolute;left:5px;top:5px;padding:2px 4px;background:rgba(5,15,21,.8);color:#e8ca9e;font-size:6px;letter-spacing:.04em}
.wb-media-empty{display:flex;flex-direction:column;gap:5px;align-items:center;justify-content:center;min-height:150px;margin:8px 0;border:1px dashed rgba(214,233,240,.18);color:rgba(204,224,231,.5);text-align:center;font-size:9px}
.wb-media-empty b{font-size:11px;font-weight:500;color:rgba(235,244,246,.78)}
.wb-media-manual{margin-top:11px;padding-top:9px;border-top:1px solid rgba(214,233,240,.13)}
.wb-media-manual label{display:block;margin-bottom:5px;font-size:8px;letter-spacing:.06em;color:rgba(205,225,232,.55)}
.wb-media-manual>div{display:flex;gap:6px}
.wb-media-manual .wb-input{flex:1;min-width:0}
.wb-media-error{margin:8px 0 0;color:#e3a486;font-size:9px}
.wb-media-picker-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:9px;padding-top:8px;border-top:1px solid rgba(214,233,240,.12);font-size:7px;color:rgba(197,219,227,.38)}
.wb-library{padding:12px 0 26px;color:var(--dsw-alias-label-primary)}
.wb-library.is-opening .wb-library-book{opacity:.24;transform:scale(.985);transition:opacity .22s ease,transform .22s ease}
.wb-library.is-opening .wb-library-cover{transform:scale(1.015);transition:transform .22s ease}
.wb-library-top{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding:8px 2px 15px}
.wb-library-brand{display:flex;gap:11px;align-items:flex-start}
.wb-library-mark{display:grid;place-items:center;width:31px;height:31px;border:1px solid rgba(190,159,116,.42);color:#d8b986;background:rgba(93,66,35,.14)}
.wb-library-top h1{margin:5px 0 5px;font-size:29px;line-height:1.1;font-weight:500;letter-spacing:-.035em;color:#f1eadf}
.wb-library-top p{margin:0;max-width:620px;font-size:10px;line-height:1.7;color:rgba(226,214,197,.58)}
.wb-library-scenes{display:flex;flex-wrap:wrap;gap:5px;align-items:center;margin:0 0 13px}
.wb-scene-switch{display:flex;flex-wrap:wrap;align-items:center;gap:5px;min-width:0}
.wb-scene-button{appearance:none;display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border:1px solid rgba(207,187,160,.2);background:rgba(74,54,35,.08);color:rgba(231,219,201,.63);font:inherit;font-size:9px;line-height:1;cursor:pointer;white-space:nowrap;transition:border-color .2s ease,color .2s ease,background .2s ease}
.wb-scene-button:hover,.wb-scene-button:focus-visible{border-color:rgba(231,202,164,.52);color:#f4e4cc;outline:none}
.wb-scene-button.is-current{border-color:rgba(215,181,133,.6);color:#f1dfc4;background:rgba(113,77,39,.2)}
.wb-scene-button:disabled{opacity:.44;cursor:not-allowed}
.wb-scene-button small{font-size:6px;letter-spacing:.05em;color:rgba(226,211,189,.55)}
.wb-scene-label{display:inline-block}
.wb-modebar{flex:0 0 auto;border-bottom:1px solid var(--dsw-alias-border-l1);background:color-mix(in srgb,var(--dsw-alias-bg-base) 88%,transparent);backdrop-filter:blur(16px)}
.wb-modebar-inner{max-width:1560px;margin:0 auto;padding:6px 24px;min-height:44px;display:flex;align-items:center;gap:14px}
.wb-modebar-kicker{font-size:8px;line-height:1;letter-spacing:.18em;text-transform:uppercase;color:var(--dsw-alias-label-dimmed);white-space:nowrap}
.wb-modebar-note{margin-left:auto;display:inline-flex;align-items:center;gap:6px;font-size:9px;letter-spacing:.04em;color:var(--dsw-alias-label-dimmed);white-space:nowrap}
.wb-header{position:relative;z-index:50}
.wb-scene-settings{position:relative;flex:none;margin-left:auto;z-index:90}
.wb-scene-settings summary{list-style:none;cursor:pointer;white-space:nowrap;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 9px;color:var(--dsw-alias-label-secondary);font-size:11px}
.wb-scene-settings summary::-webkit-details-marker{display:none}
.wb-scene-settings summary:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.wb-scene-settings-panel{position:absolute;right:0;top:calc(100% + 8px);width:min(330px,calc(100vw - 28px));max-height:min(75vh,520px);overflow:auto;box-sizing:border-box;padding:16px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;box-shadow:0 18px 48px #0008;color:var(--dsw-alias-label-primary);font-size:12px}
.wb-scene-settings-panel p{color:var(--dsw-alias-label-secondary);line-height:1.5;margin:0 0 12px}.wb-scene-settings-panel select{width:100%;margin:6px 0 12px;padding:7px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2);border-radius:6px}
.wb-scene-settings-list{display:grid;gap:4px;margin-bottom:12px}.wb-scene-settings-row{display:flex;align-items:center;gap:5px}.wb-scene-settings-row label{flex:1;display:flex;align-items:center;gap:7px}.wb-scene-settings-row button{min-width:30px;padding:4px}.wb-scene-settings-error{color:var(--dsw-alias-state-error-primary)!important}
.wb-scene-settings-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(max-width:760px){.wb-modebar-inner{flex-wrap:wrap}.wb-modebar-inner .wb-scene-switch.is-dock{flex:1 1 210px;width:auto}.wb-scene-settings{margin-left:auto}}
.wb-modebar-note i{width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-state-success-primary);box-shadow:0 0 8px color-mix(in srgb,var(--dsw-alias-state-success-primary) 55%,transparent)}
.wb-scene-switch.is-dock{flex-wrap:nowrap;gap:2px;padding:3px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 76%,transparent);box-shadow:inset 0 1px rgba(255,255,255,.03)}
.wb-scene-switch.is-dock .wb-scene-button{position:relative;border:0;border-radius:9px;padding:7px 12px;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:11px;font-weight:600;line-height:1;gap:6px;transition:color .18s ease,background .18s ease,box-shadow .18s ease}
.wb-scene-switch.is-dock .wb-scene-button:hover,.wb-scene-switch.is-dock .wb-scene-button:focus-visible{background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 72%,transparent);color:var(--dsw-alias-label-primary)}
.wb-scene-switch.is-dock .wb-scene-button.is-current{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 13%,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary);box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-brand-primary) 22%,var(--dsw-alias-border-l1)),0 4px 14px color-mix(in srgb,var(--dsw-alias-brand-primary) 8%,transparent)}
.wb-scene-switch.is-dock .wb-scene-button.is-current::after{content:"";position:absolute;left:50%;bottom:2px;width:14px;height:1px;transform:translateX(-50%);border-radius:2px;background:var(--dsw-alias-brand-primary);opacity:.8}
.wb-scene-switch.is-dock .wb-scene-button svg{opacity:.78}
.wb-scene-switch.is-dock .wb-scene-button.is-current svg{opacity:1;color:var(--dsw-alias-brand-primary)}
.wb-scene-switch.is-earth .wb-scene-button{border-color:rgba(210,229,238,.2);border-radius:999px;background:rgba(4,13,20,.22);color:rgba(226,239,244,.6);padding:4px 8px}
.wb-scene-switch.is-earth .wb-scene-button:hover,.wb-scene-switch.is-earth .wb-scene-button:focus-visible{border-color:rgba(239,247,249,.52);color:#fff}
.wb-scene-switch.is-earth .wb-scene-button.is-current{border-color:rgba(235,201,158,.62);color:#f6e3c8;background:rgba(73,52,29,.2)}
.wb-scene-switch.is-earth .wb-scene-button small{color:rgba(226,211,189,.48)}
.wb-studio .wb-scene-button{border-color:rgba(191,211,199,.24);background:rgba(37,56,47,.26);color:rgba(226,238,229,.7);font-size:10px;padding:6px 10px}
.wb-studio .wb-scene-button.is-current{border-color:rgba(201,224,203,.74);color:#f2f8ef;background:rgba(72,101,79,.4)}
.wb-studio .wb-scene-button small{font-size:7px}
.wb-library-room{display:grid;grid-template-columns:minmax(290px,37%) minmax(0,1fr);border-top:1px solid rgba(213,191,161,.2);min-height:590px;background:linear-gradient(180deg,rgba(47,35,24,.2),rgba(12,12,11,.03))}
.wb-library-shelves{padding:14px 14px 18px 2px;border-right:1px solid rgba(213,191,161,.18);min-width:0}
.wb-library-search{display:flex;align-items:center;gap:6px;border:1px solid rgba(213,191,161,.22);padding:0 8px;background:rgba(19,15,11,.25);color:rgba(226,212,192,.5)}
.wb-library-search .wb-input{border:0;background:transparent;padding:7px 0;min-width:0;width:100%;color:#eee3d1;font-size:10px;outline:none}
.wb-library-filters{display:flex;flex-wrap:wrap;gap:4px;margin:9px 0 9px}
.wb-library-filters button{border:1px solid transparent;background:transparent;color:rgba(226,213,195,.52);padding:3px 5px;font:inherit;font-size:8px;cursor:pointer}
.wb-library-filters button.on{border-color:rgba(213,181,139,.4);color:#eddbc1;background:rgba(107,75,39,.14)}
.wb-library-filters button span{color:rgba(226,211,191,.4);font-size:7px}
.wb-library-shelf-list{max-height:570px;overflow:auto;padding-right:5px}
.wb-library-shelf{margin-bottom:11px}
.wb-library-shelf-head{display:flex;align-items:baseline;justify-content:space-between;padding:5px 2px 5px;border-bottom:1px solid rgba(213,191,161,.15)}
.wb-library-shelf-head b{font-size:9px;letter-spacing:.06em;font-weight:500;color:rgba(231,216,195,.7)}
.wb-library-shelf-head span{font-size:7px;color:rgba(226,211,191,.38)}
.wb-library-spines{display:flex;flex-wrap:wrap;gap:4px;align-items:flex-end;padding:9px 0 10px;min-height:110px}
.wb-library-spine{display:flex;flex-direction:column;justify-content:space-between;align-items:flex-start;width:57px;height:var(--spine-h,104px);padding:7px 4px;border:1px solid rgba(202,174,137,.22);border-left:3px solid rgba(189,148,96,.55);background:linear-gradient(90deg,rgba(108,78,46,.38),rgba(63,47,32,.42));color:rgba(241,227,207,.82);cursor:pointer;overflow:hidden;text-align:left;transition:transform .18s ease,border-color .18s ease}
.wb-library-spine:hover,.wb-library-spine.is-active{transform:translateY(-4px);border-color:rgba(235,204,161,.65)}
.wb-library-spine.is-active{border-left-color:#e5c18b;background:linear-gradient(90deg,rgba(138,100,58,.55),rgba(76,56,36,.5))}
.wb-library-spine-title{writing-mode:vertical-rl;text-orientation:mixed;font-size:9px;line-height:1.15;letter-spacing:.02em;max-height:calc(var(--spine-h,104px) - 26px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb-library-spine-meta{font-size:6px;line-height:1.2;color:rgba(230,209,181,.46);white-space:nowrap}
.wb-library-empty{margin:7px 0;font-size:8px;color:rgba(226,211,191,.4)}
.wb-library-reading{padding:17px 18px 22px;min-width:0;background:radial-gradient(ellipse at 18% 0%,rgba(123,92,51,.12),transparent 48%)}
.wb-library-reading-head{display:flex;justify-content:space-between;gap:10px;font-size:7px;letter-spacing:.12em;text-transform:uppercase;color:rgba(219,198,170,.48);margin-bottom:13px}
.wb-library-book{display:grid;grid-template-columns:minmax(190px,36%) minmax(0,1fr);gap:20px;align-items:start}
.wb-library-cover{aspect-ratio:3/4;border:1px solid rgba(214,186,150,.33);background:linear-gradient(135deg,rgba(92,67,41,.5),rgba(38,29,21,.7));overflow:hidden;box-shadow:0 18px 40px rgba(0,0,0,.3)}
.wb-library-cover-image{width:100%;height:100%;object-fit:cover;display:block;filter:saturate(.88) contrast(1.02)}
.wb-library-cover-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;width:100%;height:100%;padding:16px;text-align:center;color:rgba(235,218,193,.62)}
.wb-library-cover-empty b{font-size:19px;font-weight:500;line-height:1.2;color:#f0dfc6}
.wb-library-cover-empty span{font-size:7px;line-height:1.55;color:rgba(226,209,184,.46)}
.wb-library-copy h2{margin:1px 0 7px;font-size:27px;line-height:1.1;font-weight:500;letter-spacing:-.04em;color:#f4ebde;text-wrap:balance}
.wb-library-path{margin:0 0 10px;font-size:8px;line-height:1.5;color:rgba(223,207,185,.45);word-break:break-all}
.wb-library-facts{display:flex;flex-wrap:wrap;gap:5px 11px;padding:8px 0;border-top:1px solid rgba(212,187,154,.16);border-bottom:1px solid rgba(212,187,154,.16);font-size:8px;color:rgba(231,215,193,.58)}
.wb-library-note{margin:11px 0;font-size:10px;line-height:1.8;color:rgba(231,219,201,.7);max-width:56ch}
.wb-library-reading-meta{display:flex;flex-direction:column;gap:2px;margin:8px 0 13px}
.wb-library-reading-meta span{font-size:7px;letter-spacing:.1em;text-transform:uppercase;color:rgba(219,198,170,.4)}
.wb-library-reading-meta b{font-size:9px;font-weight:500;color:rgba(240,226,207,.72)}
.wb-library-actions{display:flex;flex-wrap:wrap;gap:6px}
.wb-library-actions .wb-btn{font-size:9px;padding:6px 9px}
.wb-library-disclaimer{margin:22px 0 0;font-size:7px;line-height:1.5;color:rgba(218,200,176,.36)}
.wb-library-empty-reading{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:360px;color:rgba(230,212,187,.46);gap:8px;font-size:10px}
@media (max-width:900px){.wb-library-room{grid-template-columns:1fr}.wb-library-shelves{border-right:0;border-bottom:1px solid rgba(213,191,161,.18);padding-right:2px}.wb-library-shelf-list{max-height:260px}.wb-library-book{grid-template-columns:minmax(120px,30%) minmax(0,1fr);gap:12px}.wb-library-top h1{font-size:24px}}
@media (max-width:620px){.wb-library-book{grid-template-columns:1fr}.wb-library-cover{max-width:180px}.wb-library-reading{padding:14px 4px}.wb-library-top{flex-direction:column}.wb-library-copy h2{font-size:22px}}
.wb-studio{position:relative;height:calc(100vh - 392px);min-height:520px;overflow:hidden;border:1px solid rgba(180,204,188,.16);color:var(--dsw-alias-label-primary);background:radial-gradient(ellipse at 78% 16%,rgba(166,128,73,.08),transparent 38%),radial-gradient(ellipse at 24% 86%,rgba(69,105,79,.12),transparent 44%),#0b110e}
.wb-studio.is-entering .wb-studio-plan{opacity:.24;filter:blur(1.5px);transition:opacity .26s ease,filter .26s ease}
.wb-studio.is-entering .wb-studio-inspector{opacity:.38;transition:opacity .26s ease}
.wb-studio.is-entering .wb-studio-desk.is-active{transform:scale(1.04);z-index:3;border-color:rgba(225,204,154,.85);box-shadow:0 10px 30px rgba(0,0,0,.35),inset 0 0 0 1px rgba(225,204,154,.22);transition:transform .26s ease,border-color .26s ease,box-shadow .26s ease}
.wb-studio-top{position:absolute;z-index:10;left:0;right:0;top:0;display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:14px 20px 10px;pointer-events:none;background:linear-gradient(180deg,rgba(8,14,11,.94),rgba(8,14,11,.62) 58%,transparent)}
.wb-studio-brand{display:flex;align-items:flex-start;gap:11px;min-width:0}
.wb-studio-mark{display:grid;place-items:center;flex:0 0 auto;width:30px;height:30px;border:1px solid rgba(163,194,169,.4);color:#b9d4b7;background:rgba(49,76,58,.22)}
.wb-studio-overline{margin-top:3px;font-size:7px;line-height:1.4;letter-spacing:.16em;color:rgba(195,216,198,.5)}
.wb-studio-top h1{margin:3px 0;font-size:24px;line-height:1.08;font-weight:500;letter-spacing:-.035em;color:#eef5ec}
.wb-studio-top p{margin:0;max-width:620px;font-size:9px;line-height:1.6;color:rgba(208,226,213,.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-studio-search{display:flex;align-items:center;gap:6px;flex:0 1 265px;min-width:170px;border:1px solid rgba(191,211,199,.22);padding:0 8px;background:rgba(19,28,23,.58);color:rgba(208,226,213,.52);pointer-events:auto}
.wb-studio-search input{width:100%;min-width:0;border:0;outline:none;background:transparent;color:#eef5ec;font:inherit;font-size:10px;padding:7px 0}
.wb-studio-scenes{position:absolute;z-index:11;left:20px;top:76px;display:flex;flex-wrap:wrap;gap:5px;align-items:center;margin:0}
.wb-studio-body{position:absolute;inset:0;display:grid;grid-template-columns:minmax(0,1fr) 270px;gap:0;align-items:stretch}
.wb-studio-stage-wrap{position:relative;min-width:0;height:100%;min-height:0;overflow:hidden}
.wb-studio-stagebar{position:absolute;z-index:6;left:auto;right:18px;top:70px;display:flex;align-items:center;gap:10px;justify-content:flex-end;min-height:26px;padding:0;color:rgba(205,225,212,.48);font-size:8px;pointer-events:none}
.wb-studio-crumb,.wb-studio-stage-count{display:none}
.wb-studio-stagebar .wb-studio-zoom,.wb-studio-stagebar .wb-scene-details-toggle{pointer-events:auto}

.wb-studio-stage-count{white-space:nowrap}
.wb-studio-zoom{display:flex;align-items:center;gap:3px;flex:0 0 auto}
.wb-studio-zoom button{appearance:none;border:1px solid rgba(191,211,199,.2);background:rgba(37,56,47,.22);color:rgba(221,235,223,.68);font:inherit;font-size:9px;line-height:1;padding:4px 7px;cursor:pointer}
.wb-studio-zoom button:hover,.wb-studio-zoom button:focus-visible{border-color:rgba(207,230,212,.55);color:#f1f8ef;outline:none}
.wb-studio-zoom span{min-width:34px;text-align:center;font-size:8px;color:rgba(207,226,211,.52)}
.wb-studio-viewport{position:absolute;inset:0;height:100%;min-height:0;max-height:none;overflow:hidden;border:0;background:radial-gradient(ellipse at 74% 18%,rgba(179,140,83,.11),transparent 36%),radial-gradient(ellipse at 28% 82%,rgba(74,113,86,.13),transparent 42%),#0d1310;cursor:grab;touch-action:none;outline:none}
.wb-studio-viewport:active{cursor:grabbing}
.wb-studio-viewport:focus-visible{box-shadow:0 0 0 1px rgba(201,229,207,.52) inset}
.wb-studio-plan{position:absolute;left:50%;top:calc(50% + 8px);width:1040px;height:600px;margin-left:-520px;margin-top:-300px;transform-origin:center center;background:linear-gradient(90deg,rgba(151,179,156,.045) 1px,transparent 1px),linear-gradient(rgba(151,179,156,.045) 1px,transparent 1px);background-size:40px 40px;will-change:transform}
.wb-studio.is-room .wb-studio-plan{left:0;top:0;width:100%;height:100%;margin:0;transform:none!important}
.wb-studio.is-room .wb-studio-plan-head{display:none}
.wb-studio.is-room .wb-studio-top,.wb-studio.is-room .wb-studio-scenes,.wb-studio.is-room .wb-studio-stagebar{opacity:0;pointer-events:none}
.wb-studio-plan::after{content:"";position:absolute;inset:40px 10px 8px;pointer-events:none;border:1px solid rgba(182,204,188,.09);box-shadow:0 0 0 10px rgba(5,10,8,.12)}
.wb-studio-plan-head{position:absolute;z-index:3;left:18px;right:18px;top:13px;display:flex;align-items:baseline;justify-content:space-between;gap:16px}
.wb-studio-plan-kicker{font-size:7px;letter-spacing:.15em;color:rgba(194,217,199,.43)}
.wb-studio-plan-note{font-size:7px;line-height:1.45;color:rgba(194,217,199,.3);text-align:right;max-width:430px}
.wb-studio-room{position:absolute;z-index:2;appearance:none;display:flex;flex-direction:column;gap:5px;padding:13px 14px;border:1px solid rgba(177,203,184,.17);background:linear-gradient(145deg,rgba(35,49,41,.94),rgba(17,26,22,.94));color:rgba(228,241,230,.82);text-align:left;cursor:pointer;overflow:hidden;box-shadow:inset 0 1px rgba(255,255,255,.035),0 16px 34px rgba(0,0,0,.16);transition:border-color .2s ease,background .2s ease,transform .2s ease}
.wb-studio-room::before{content:"";position:absolute;left:14px;bottom:0;width:44px;height:3px;background:rgba(180,204,185,.26)}
.wb-studio-room::after{content:"";position:absolute;right:0;top:44px;width:9px;height:34px;background:rgba(9,15,12,.55);border-left:1px solid rgba(177,203,184,.12)}
.wb-studio-room:hover,.wb-studio-room:focus-visible{border-color:rgba(205,230,211,.5);background:linear-gradient(145deg,rgba(43,61,50,.97),rgba(20,31,26,.97));outline:none;transform:translateY(-1px)}
.wb-studio-room.has-active{border-color:rgba(210,191,145,.62);box-shadow:inset 0 0 0 1px rgba(210,191,145,.12),0 16px 34px rgba(0,0,0,.18)}
.wb-studio-room.is-offices{border-color:rgba(197,175,132,.27);background:linear-gradient(145deg,rgba(47,45,35,.95),rgba(23,25,20,.95))}
.wb-studio-room.is-workshop::before{background:rgba(146,188,153,.45)}
.wb-studio-room.is-shared::before{background:rgba(150,174,191,.38)}
.wb-studio-room.is-intake::before{background:rgba(166,164,147,.35)}
.wb-studio-room-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.wb-studio-room-code{font-size:9px;letter-spacing:.12em;color:rgba(196,220,200,.44)}
.wb-studio-room-count{font-size:9px;color:rgba(208,228,211,.46);white-space:nowrap}
.wb-studio-room-name{font-size:15px;line-height:1.2;font-weight:500;letter-spacing:-.01em;color:#eaf3e8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb-studio-room-note{font-size:8px;color:rgba(216,231,211,.44)}
.wb-studio-room-names{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;color:rgba(218,234,218,.6);font-size:10px;line-height:1.45;overflow:hidden;max-height:46px}
.wb-studio-room-names span{padding:2px 4px;border:1px solid rgba(177,203,184,.12);background:rgba(9,16,12,.18);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.wb-studio-room-names span.is-more{color:rgba(210,229,212,.36);border-color:transparent;background:none}
.wb-studio-room-foot{margin-top:auto;font-size:9px;letter-spacing:.04em;color:rgba(206,226,208,.42)}
.wb-studio-corridor{position:absolute;z-index:1;border-top:1px dashed rgba(181,204,186,.15);border-bottom:1px dashed rgba(181,204,186,.15);background:linear-gradient(180deg,rgba(28,42,34,.3),rgba(15,23,19,.15))}
.wb-studio-corridor-label{position:absolute;left:18px;top:15px;font-size:7px;letter-spacing:.14em;color:rgba(194,217,199,.38)}
.wb-studio-corridor-count{position:absolute;left:18px;top:31px;font-size:8px;color:rgba(207,228,209,.34)}
.wb-studio-cafe{position:absolute;right:22px;top:14px;width:118px;height:94px;border:1px solid rgba(189,173,136,.22);background:linear-gradient(180deg,rgba(74,60,34,.2),rgba(18,25,20,.34))}
.wb-studio-cafe::before{content:"";position:absolute;left:13px;bottom:20px;width:26px;height:17px;border:1px solid rgba(216,195,153,.5);border-radius:0 0 7px 7px;background:rgba(208,186,143,.12)}
.wb-studio-cafe::after{content:"";position:absolute;left:39px;bottom:24px;width:7px;height:10px;border:1px solid rgba(216,195,153,.44);border-left:0;border-radius:0 5px 5px 0}
.wb-studio-cafe i{position:absolute;left:21px;bottom:45px;width:3px;height:15px;border-radius:50%;background:rgba(230,226,199,.34);filter:blur(1.3px);animation:wb-studio-steam 5.8s ease-in-out infinite}
.wb-studio-cafe i:nth-child(2){left:27px;height:19px;animation-delay:-1.7s}
.wb-studio-cafe i:nth-child(3){left:32px;height:13px;animation-delay:-3.2s}
.wb-studio-cafe b{position:absolute;left:11px;bottom:5px;font-size:7px;font-weight:400;letter-spacing:.02em;color:rgba(218,215,184,.34)}
.wb-studio-plant{position:absolute;left:17px;bottom:14px;width:41px;height:52px}
.wb-studio-plant::before{content:"";position:absolute;left:7px;bottom:0;width:27px;height:20px;border:1px solid rgba(160,135,98,.34);border-radius:0 0 8px 8px;background:rgba(119,91,56,.2)}
.wb-studio-plant i{position:absolute;left:18px;bottom:17px;width:12px;height:25px;border:1px solid rgba(136,178,140,.28);border-radius:50% 50% 40% 40%;background:rgba(82,128,88,.18);transform-origin:50% 100%;animation:wb-studio-sway 8s ease-in-out infinite}
.wb-studio-plant i:nth-child(2){left:8px;height:19px;transform:rotate(-27deg);animation-delay:-2.4s}
.wb-studio-plant i:nth-child(3){left:27px;height:21px;transform:rotate(26deg);animation-delay:-4.1s}
.wb-studio-entry{position:absolute;left:50%;bottom:15px;transform:translateX(-50%);font-size:8px;letter-spacing:.12em;color:rgba(215,230,212,.38);white-space:nowrap}
.wb-studio-ambient-note{position:absolute;right:18px;bottom:12px;font-size:7px;color:rgba(196,218,199,.28)}
.wb-studio-no-match{position:absolute;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;border:1px dashed rgba(190,213,194,.2);color:rgba(214,231,215,.5);text-align:center;padding:20px}
.wb-studio-no-match b{font-size:14px;font-weight:500;color:rgba(231,242,229,.74)}
.wb-studio-no-match span{font-size:9px}
.wb-studio-room-detail{position:absolute;z-index:4;inset:18px;display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(189,211,194,.22);background:linear-gradient(90deg,rgba(151,179,156,.04) 1px,transparent 1px),linear-gradient(rgba(151,179,156,.04) 1px,transparent 1px),linear-gradient(145deg,rgba(26,38,31,.985),rgba(13,20,16,.99));background-size:36px 36px,36px 36px,auto;box-shadow:0 24px 70px rgba(0,0,0,.28)}
.wb-studio-detail-head{display:flex;align-items:flex-start;gap:14px;padding:14px 16px 12px;border-bottom:1px solid rgba(184,206,188,.13)}
.wb-studio-back{appearance:none;border:0;background:none;color:rgba(211,230,213,.55);font:inherit;font-size:9px;padding:2px 0;cursor:pointer;white-space:nowrap}
.wb-studio-back:hover,.wb-studio-back:focus-visible{color:#edf6ea;outline:none}
.wb-studio-detail-title{display:flex;align-items:baseline;flex-wrap:wrap;gap:7px;min-width:0}
.wb-studio-detail-code{font-size:8px;letter-spacing:.12em;color:rgba(196,220,200,.38)}
.wb-studio-detail-title strong{font-size:15px;font-weight:500;color:#edf5eb}
.wb-studio-detail-title small{font-size:8px;color:rgba(206,226,208,.4)}
.wb-studio-detail-hint{margin-left:auto;max-width:300px;font-size:7px;line-height:1.45;color:rgba(201,221,204,.34);text-align:right}
.wb-studio-desks{display:grid;flex:1 1 auto;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));grid-auto-rows:minmax(124px,1fr);align-content:stretch;gap:8px;padding:12px 16px 18px;overflow:auto;min-height:0}
.wb-studio-desks.is-offices{grid-template-columns:repeat(auto-fit,minmax(250px,1fr));grid-auto-rows:minmax(0,1fr);align-content:stretch;gap:12px;padding:16px 18px}
.wb-studio-desk{position:relative;appearance:none;display:flex;flex-direction:column;gap:5px;min-height:124px;padding:9px 10px 8px;border:1px solid rgba(180,203,185,.16);border-bottom:3px solid rgba(131,166,137,.35);background:linear-gradient(160deg,rgba(42,59,48,.65),rgba(17,27,21,.76));color:rgba(228,241,229,.8);text-align:left;cursor:pointer;overflow:hidden;transition:border-color .18s ease,background .18s ease,transform .18s ease}
.wb-studio-desk:hover,.wb-studio-desk:focus-visible{border-color:rgba(205,230,208,.5);background:linear-gradient(160deg,rgba(52,74,59,.78),rgba(21,33,25,.85));outline:none;transform:translateY(-2px)}
.wb-studio-desk.is-active{border-color:rgba(218,197,148,.68);border-bottom-color:rgba(218,197,148,.72);box-shadow:inset 0 0 0 1px rgba(218,197,148,.12)}
.wb-studio-desk.is-office{min-height:0;padding:12px 13px 10px;background:linear-gradient(165deg,rgba(56,61,43,.72),rgba(22,30,22,.9))}
.wb-studio-desks.is-offices .wb-studio-desk-image{flex:1 1 auto;height:auto;min-height:92px;max-height:none;object-fit:cover}
.wb-studio-desk.is-office .wb-studio-desk-name{font-size:13px;line-height:1.35;-webkit-line-clamp:3}
.wb-studio-desk.is-office .wb-studio-desk-meta{font-size:8px;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.wb-studio-desk.is-office .wb-studio-desk-foot{font-size:8px}
.wb-studio-desk-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.wb-studio-desk-lamp{width:5px;height:5px;border-radius:50%;background:rgba(221,198,147,.75);box-shadow:0 0 7px rgba(221,198,147,.35)}
.wb-studio-desk-code{font-size:8px;letter-spacing:.08em;color:rgba(206,228,209,.42)}
.wb-studio-desk-image{display:block;width:100%;height:48px;object-fit:cover;border:1px solid rgba(190,214,194,.12);filter:saturate(.8) contrast(1.02)}
.wb-studio-desk.is-office .wb-studio-desk-image{height:78px}
.wb-studio-desk-image-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;width:100%;height:48px;border:1px dashed rgba(190,214,194,.13);background:linear-gradient(135deg,rgba(97,128,101,.08),rgba(9,16,12,.18));color:rgba(196,219,199,.3);font-size:7px}
.wb-studio-desk-monogram{display:none}
.wb-studio-desk.is-office .wb-studio-desk-image-empty{flex:1 1 auto;height:auto;min-height:92px;background:radial-gradient(ellipse at 50% 34%,rgba(156,173,126,.1),transparent 48%),linear-gradient(135deg,rgba(97,128,101,.07),rgba(9,16,12,.18))}
.wb-studio-desk.is-office .wb-studio-desk-image-empty svg{display:none}
.wb-studio-desk.is-office .wb-studio-desk-monogram{display:block;font-size:54px;line-height:1;font-weight:400;letter-spacing:-.06em;color:rgba(218,234,218,.13)}
.wb-studio-desk.is-office .wb-studio-desk-image-empty>span{font-size:8px;letter-spacing:.06em;color:rgba(205,224,207,.3)}
.wb-studio-desks.is-offices .wb-studio-desk-image-empty{flex:1 1 auto;height:auto;min-height:92px}
.wb-studio-desk-name{font-size:11px;line-height:1.35;font-weight:500;color:#ebf4e8;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.wb-studio-desk-meta{font-size:8px;line-height:1.4;color:rgba(203,224,206,.46);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb-studio-desk-foot{display:flex;justify-content:space-between;gap:6px;margin-top:auto;font-size:8px;color:rgba(196,217,199,.35);white-space:nowrap}
.wb-studio-empty{padding:30px 18px;color:rgba(208,226,211,.45);font-size:10px}
.wb-studio-room-floor{display:flex;align-items:center;gap:6px;flex:0 0 auto;padding:7px 18px;border-top:1px solid rgba(184,206,188,.1);font-size:7px;letter-spacing:.03em;color:rgba(194,216,197,.3)}
.wb-studio-inspector{position:relative;height:100%;min-width:0;padding:122px 14px 14px 16px;border-left:1px solid rgba(184,206,188,.14);overflow:auto;background:linear-gradient(180deg,rgba(13,21,16,.84),rgba(9,16,12,.72))}
.wb-studio.is-room .wb-studio-inspector{padding-top:18px}
.wb-studio-inspector-overline{font-size:7px;letter-spacing:.12em;text-transform:uppercase;color:rgba(191,216,196,.42);margin-bottom:5px}
.wb-studio-inspector h2{margin:0 0 5px;font-size:24px;line-height:1.12;font-weight:500;letter-spacing:-.04em;color:#f1f7ef;overflow-wrap:anywhere}
.wb-studio-path{margin:0 0 9px;font-size:8px;line-height:1.5;color:rgba(200,221,202,.4);word-break:break-all}
.wb-studio-facts{display:flex;flex-wrap:wrap;gap:4px 9px;padding:7px 0;border-top:1px solid rgba(182,206,186,.13);border-bottom:1px solid rgba(182,206,186,.13);font-size:8px;line-height:1.45;color:rgba(217,234,216,.6)}
.wb-studio-photo{position:relative;margin:11px 0 9px;aspect-ratio:16/10;overflow:hidden;border:1px solid rgba(185,209,188,.16);background:rgba(8,15,11,.4)}
.wb-studio-photo-image{display:block;width:100%;height:100%;object-fit:cover;filter:saturate(.84) contrast(1.02)}
.wb-studio-photo-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;height:100%;padding:13px;text-align:center;color:rgba(206,226,209,.44);font-size:8px;line-height:1.55}
.wb-studio-photo-change{position:absolute;right:5px;bottom:5px;appearance:none;border:1px solid rgba(220,233,211,.25);background:rgba(8,17,12,.72);color:rgba(232,243,229,.78);font:inherit;font-size:7px;padding:3px 5px;cursor:pointer}
.wb-studio-photo-change:hover,.wb-studio-photo-change:focus-visible{border-color:rgba(234,243,224,.58);color:#fff;outline:none}
.wb-studio-record{display:flex;flex-direction:column;gap:2px;margin:8px 0}
.wb-studio-record span{font-size:7px;letter-spacing:.1em;text-transform:uppercase;color:rgba(191,216,196,.4)}
.wb-studio-record b{font-size:9px;font-weight:500;color:rgba(229,241,224,.68)}
.wb-studio-note{margin:7px 0;font-size:9.5px;line-height:1.75;color:rgba(214,232,214,.65);display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden}
.wb-studio-evidence{display:flex;gap:5px;align-items:flex-start;margin:8px 0;padding:6px 0;border-top:1px solid rgba(182,206,186,.12);font-size:7px;line-height:1.5;color:rgba(196,218,199,.36)}
.wb-studio-actions{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}
.wb-studio-actions .wb-btn{font-size:8px;padding:6px 8px}
.wb-studio-inspector-empty{display:flex;flex-direction:column;gap:8px;padding:14px 0}
.wb-studio-empty-mark{display:grid;place-items:center;width:38px;height:38px;border:1px solid rgba(185,210,188,.22);color:rgba(200,225,203,.62);background:rgba(44,68,52,.2)}
.wb-studio-inspector-empty b{font-size:15px;font-weight:500;color:rgba(232,243,228,.82)}
.wb-studio-inspector-empty p{margin:0;font-size:9px;line-height:1.7;color:rgba(207,226,209,.46)}
.wb-studio-mini-stats{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
.wb-studio-mini-stats span{padding:4px 6px;border:1px solid rgba(184,208,187,.14);font-size:8px;color:rgba(212,231,213,.54)}
.wb-studio-legend{display:flex;flex-direction:column;gap:0;margin-top:4px;border-top:1px solid rgba(184,208,187,.12)}
.wb-studio-legend>div{display:grid;grid-template-columns:8px minmax(0,1fr) auto;gap:7px;align-items:center;padding:6px 0;border-bottom:1px solid rgba(184,208,187,.09)}
.wb-studio-legend i{width:5px;height:5px;border-radius:50%;background:rgba(188,204,176,.55)}
.wb-studio-legend .is-persistent i{background:rgba(213,165,115,.85)}
.wb-studio-legend .is-incubating i{background:rgba(140,185,147,.82)}
.wb-studio-legend .is-temporary i{background:rgba(146,174,191,.72)}
.wb-studio-legend .is-unclassified i{background:rgba(169,166,145,.62)}
.wb-studio-legend span{font-size:8px;color:rgba(210,229,212,.52)}
.wb-studio-legend b{font-size:9px;font-weight:500;color:rgba(231,242,228,.7);font-variant-numeric:tabular-nums}
.wb-studio-layout-note{margin:4px 0 0;font-size:7px;line-height:1.55;color:rgba(194,216,197,.32)}
.wb-studio-disclaimer{display:none}
@keyframes wb-studio-steam{0%{opacity:0;transform:translateY(4px) scale(.8)}25%{opacity:.42}70%{opacity:.2}100%{opacity:0;transform:translateY(-13px) scale(1.18)}}
@keyframes wb-studio-sway{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(3deg)}}
@media (max-width:1180px){.wb-studio-body{grid-template-columns:minmax(0,1fr) 242px}.wb-studio-inspector{padding-top:120px;padding-left:12px}.wb-studio-inspector h2{font-size:21px}.wb-studio-top h1{font-size:23px}.wb-studio-top p{max-width:480px}.wb-studio-search{flex:0 1 220px}}
@media (max-width:980px){
  .wb-studio{height:auto;min-height:0;overflow:visible;border:0;background:transparent}
  .wb-studio-top{position:relative;flex-direction:column;gap:8px;padding:10px 0 8px;background:none;pointer-events:auto}
  .wb-studio-top p{white-space:normal;font-size:9px;max-width:640px}
  .wb-studio-search{flex:1 1 auto;width:100%;min-width:0}
  .wb-studio-scenes{position:static;margin:0 0 8px}
  .wb-studio-body{position:relative;inset:auto;display:grid;grid-template-columns:1fr;gap:10px}
  .wb-studio-stage-wrap{height:440px;min-height:0;border:1px solid rgba(180,204,188,.16)}
  .wb-studio-stagebar{top:8px;left:12px;right:12px}
  .wb-studio-inspector{height:auto;max-height:none;padding:12px 0 0;border-left:0;border-top:1px solid rgba(184,206,188,.14);overflow:visible;background:none}
  .wb-studio.is-room .wb-studio-inspector{padding-top:12px}
  .wb-studio.is-room .wb-studio-top,.wb-studio.is-room .wb-studio-scenes,.wb-studio.is-room .wb-studio-stagebar{display:none}
  .wb-studio-plan{top:calc(50% + 20px)}
  .wb-studio-stage-count{display:none}
  .wb-studio-plan-note{display:none}
  .wb-studio-detail-hint{display:none}
}
@media (max-width:760px){
  .wb-studio-viewport{overflow:auto;cursor:default}
  .wb-studio-plan{position:relative;left:auto;top:auto;width:auto;height:auto;margin:0;transform:none!important;display:grid;grid-template-columns:repeat(auto-fill,minmax(165px,1fr));gap:8px;padding:44px 10px 10px;background-size:32px 32px}
  .wb-studio-plan::after{display:none}
  .wb-studio-plan-head{position:static;grid-column:1/-1;margin:0 0 2px;padding:0 2px}
  .wb-studio-room{position:static!important;left:auto!important;top:auto!important;width:auto!important;height:auto!important;min-height:132px}
  .wb-studio-corridor{display:none}
  .wb-studio-no-match{position:static!important;left:auto!important;top:auto!important;width:auto!important;height:auto!important;grid-column:1/-1;padding:32px 16px}
  .wb-studio-zoom{display:none}
  .wb-studio.is-room .wb-studio-plan{position:absolute;inset:0;display:block;width:auto;height:auto;padding:0}
  .wb-studio.is-room .wb-studio-plan-head{display:none}
  .wb-studio.is-room .wb-studio-room-detail{inset:6px}
}
@media (max-width:620px){.wb-studio-top h1{font-size:22px}.wb-studio-stage-wrap{height:400px}.wb-studio-stagebar{flex-wrap:wrap;gap:6px}.wb-studio-desks{grid-template-columns:repeat(auto-fill,minmax(180px,1fr));padding:10px}.wb-studio-room-name{font-size:13px}.wb-studio-plan-head .wb-studio-plan-kicker{font-size:6px}.wb-studio-inspector h2{font-size:20px}}
@media (prefers-reduced-motion:reduce){.wb-studio-plan,.wb-studio-room,.wb-studio-desk,.wb-scene-button{transition:none}.wb-studio-cafe i,.wb-studio-plant i{animation:none;opacity:.28}}
.wb-atelier-plan{background:#0c120f!important}
.wb-atelier-plan::after{display:none}
.wb-atelier-scene{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:2px 2px 0}
.wb-atelier-scene.is-room{padding:0}
.wb-atelier-svg{display:block;width:100%;height:100%;overflow:visible;font-family:inherit;user-select:none}
.wb-atelier-backdrop{fill:transparent}
.wb-atelier-planks{opacity:.72;pointer-events:none}
.wb-atelier-pendant-line{stroke:rgba(215,193,157,.28);stroke-width:1;fill:none}
.wb-atelier-pendant-shade{fill:rgba(44,34,23,.9);stroke:rgba(233,203,151,.4);stroke-width:1}
.wb-atelier-pendant-glow{fill:rgba(230,195,130,.13)}
.wb-atelier-room-floor{fill:#3a3126;stroke:rgba(216,191,150,.16);stroke-width:1}
.wb-atelier-corridor{fill:#1b1712;stroke:rgba(214,190,151,.1);stroke-width:1}
.wb-atelier-corridor-label{fill:rgba(190,213,196,.44);font-size:7px;letter-spacing:.12em}
.wb-atelier-corridor-line{stroke:rgba(187,210,194,.16);stroke-width:1;stroke-dasharray:2 7}
.wb-atelier-wing-light{fill:url(#wbAtelierLamp);pointer-events:none}
.wb-atelier-wing-bottom{stroke:rgba(202,220,205,.22);stroke-width:3;fill:none}
.wb-atelier-door-glow{fill:rgba(226,197,139,.22);filter:drop-shadow(0 0 4px rgba(224,190,126,.3))}
.wb-atelier-room-light{fill:url(#wbAtelierRoomLamp);pointer-events:none}
.wb-atelier-room-rug{fill:rgba(104,83,55,.26);stroke:rgba(220,196,156,.12);stroke-width:1}
.wb-atelier-room-bottomwall{fill:#0b120e;stroke:rgba(188,210,193,.14);stroke-width:1}
.wb-atelier-shelf-back{fill:rgba(82,66,43,.48);stroke:rgba(201,176,132,.2);stroke-width:1}
.wb-atelier-shelf-line{stroke:rgba(214,190,151,.2);stroke-width:1;fill:none}
.wb-atelier-book{fill:rgba(195,166,118,.45)}
.wb-atelier-printer-body{fill:rgba(175,191,178,.16);stroke:rgba(206,221,207,.24);stroke-width:1}
.wb-atelier-printer-paper{fill:rgba(232,229,211,.4)}
.wb-atelier-printer-dot{fill:#a6c2a9}
.wb-atelier-walker{animation:wbAtelierWalkRoom 17s ease-in-out infinite}
.wb-atelier-walker.is-room{animation-delay:-4s}
.wb-atelier-walker.is-corridor{animation:wbAtelierWalkCorridor 26s ease-in-out infinite}

.wb-atelier-room-sidewall{stroke:rgba(8,14,10,.86);stroke-width:16;fill:none}
.wb-atelier-room-baseboard{stroke:rgba(193,214,197,.18);stroke-width:1.5;fill:none}
.wb-atelier-room-door{fill:rgba(224,195,139,.16);stroke:rgba(224,195,139,.28);stroke-width:1}
.wb-atelier-desk-back{fill:rgba(17,27,21,.78);stroke:rgba(185,207,190,.2);stroke-width:.6}
.wb-atelier-desk-lamp{fill:rgba(235,204,145,.65);filter:drop-shadow(0 0 4px rgba(233,197,129,.45))}
.wb-atelier-chair{fill:rgba(30,42,34,.9);stroke:rgba(184,205,188,.25);stroke-width:.7}
.wb-atelier-pantry-light{fill:url(#wbAtelierLamp);opacity:.8}
.wb-atelier-fridge{fill:rgba(172,190,175,.14);stroke:rgba(203,220,205,.2);stroke-width:1}
.wb-atelier-fridge-line{stroke:rgba(213,227,215,.22);stroke-width:1;fill:none}
.wb-atelier-shelf{fill:rgba(157,129,87,.3);stroke:rgba(211,185,140,.18);stroke-width:.6}
.wb-atelier-jar{fill:rgba(209,190,150,.32);stroke:rgba(225,207,168,.28);stroke-width:.5}
.wb-atelier-wing{cursor:pointer;outline:none}
.wb-atelier-wing-shadow{fill:rgba(0,0,0,.32)}
.wb-atelier-wing-floor{fill:url(#wbAtelierFloor);stroke:rgba(218,191,149,.2);stroke-width:1;transition:fill .2s ease,stroke .2s ease}
.wb-atelier-wing-wall{fill:#15120e;stroke:rgba(218,194,154,.12);stroke-width:1}
.wb-atelier-wing-side{fill:rgba(5,10,7,.42);stroke:rgba(181,205,188,.08);stroke-width:1}
.wb-atelier-wing:hover .wb-atelier-wing-floor,.wb-atelier-wing:focus-visible .wb-atelier-wing-floor{fill:#4b4031;stroke:rgba(228,203,157,.66)}
.wb-atelier-wing.has-active .wb-atelier-wing-floor{stroke:rgba(214,190,139,.45)}
.wb-atelier-window{fill:rgba(158,190,178,.14);stroke:rgba(196,219,205,.18);stroke-width:.8}
.wb-atelier-floor-rule{stroke:rgba(189,211,194,.08);stroke-width:1}
.wb-atelier-plaque-bg{fill:rgba(9,16,12,.76);stroke:rgba(184,207,190,.15);stroke-width:1}
.wb-atelier-plaque-code{fill:rgba(228,204,156,.9);font-size:15px;letter-spacing:.06em}
.wb-atelier-plaque-name{fill:#f0f6ed;font-size:11.5px;font-weight:500}
.wb-atelier-plaque-meta{fill:rgba(207,225,209,.58);font-size:8px}
.wb-atelier-wing-arrow{fill:rgba(217,197,154,.5)}
.wb-atelier-cabin{fill:rgba(41,53,43,.42);stroke:rgba(190,211,195,.23);stroke-width:1}
.wb-atelier-glass{stroke:rgba(170,202,186,.3);stroke-width:1.5;fill:none}
.wb-atelier-whiteboard{fill:rgba(218,229,216,.09);stroke:rgba(197,220,202,.2);stroke-width:1}
.wb-atelier-whiteboard-line{stroke:rgba(197,220,202,.32);stroke-width:1}
.wb-atelier-bench{fill:rgba(92,79,57,.36);stroke:rgba(194,172,132,.2);stroke-width:1}
.wb-atelier-bench-line{stroke:rgba(213,193,157,.22);stroke-width:1}
.wb-atelier-cup{fill:rgba(222,226,210,.48);stroke:rgba(238,241,226,.2);stroke-width:.6}
.wb-atelier-locker{fill:rgba(56,68,61,.45);stroke:rgba(191,207,195,.18);stroke-width:1}
.wb-atelier-locker-line{stroke:rgba(191,207,195,.22);stroke-width:1}
.wb-atelier-commons{fill:rgba(94,75,49,.3);stroke:rgba(197,170,127,.18);stroke-width:1}
.wb-atelier-commons-line{stroke:rgba(202,178,139,.2);stroke-width:1}
.wb-atelier-plate{fill:rgba(225,220,198,.2);stroke:rgba(226,220,197,.25);stroke-width:.8}
.wb-atelier-archive{fill:rgba(60,55,43,.52);stroke:rgba(191,180,151,.18);stroke-width:1}
.wb-atelier-archive-line{stroke:rgba(202,190,158,.22);stroke-width:1}
.wb-atelier-box{fill:rgba(108,89,56,.38);stroke:rgba(200,177,131,.24);stroke-width:1}
.wb-atelier-box.is-low{fill:rgba(82,71,51,.4)}
.wb-atelier-box-line{stroke:rgba(218,196,155,.25);stroke-width:.8}
.wb-atelier-plant-pot{fill:rgba(101,72,46,.6);stroke:rgba(202,170,122,.3);stroke-width:1}
.wb-atelier-plant-leaf{fill:rgba(78,124,91,.52);stroke:rgba(128,169,132,.28);stroke-width:1}
.wb-atelier-mini-desk{transition:opacity .15s ease}
.wb-atelier-mini-shadow{fill:rgba(0,0,0,.28)}
.wb-atelier-mini-table{fill:#314137;stroke:rgba(189,211,194,.2);stroke-width:.8}
.wb-atelier-mini-screen{fill:#15221a;stroke:rgba(158,192,168,.28);stroke-width:.6}
.wb-atelier-mini-paper{fill:rgba(226,218,190,.35)}
.wb-atelier-mini-desk.is-active .wb-atelier-mini-table{fill:#4a4a36;stroke:rgba(224,201,149,.8);stroke-width:1.4}
.wb-atelier-mini-desk.is-running .wb-atelier-mini-screen{fill:#2f6348}
.wb-atelier-state-dot{fill:#77877d;stroke:rgba(9,14,11,.8);stroke-width:.8}
.wb-atelier-state-dot.is-running{fill:#8cc59b}
.wb-atelier-state-dot.is-waiting{fill:#d8b66e}
.wb-atelier-state-dot.is-failed{fill:#c97a71}
.wb-atelier-state-dot.is-attention{fill:#c79b62}
.wb-atelier-state-dot.is-idle{fill:#77877d}
.wb-atelier-figure{color:#81998a}
.wb-atelier-figure.is-running{color:#8fc39b}
.wb-atelier-figure.is-waiting{color:#d4b273}
.wb-atelier-figure.is-failed{color:#c47b72}
.wb-atelier-figure.is-attention{color:#c49a66}
.wb-atelier-figure.is-idle{color:#81998a}
.wb-atelier-figure-shadow{fill:rgba(0,0,0,.24)}
.wb-atelier-figure-body{fill:currentColor;stroke:rgba(8,15,10,.4);stroke-width:.7}
.wb-atelier-figure-legs{fill:#26342c;stroke:rgba(9,15,11,.5);stroke-width:.6}
.wb-atelier-figure-arm{stroke:currentColor;stroke-width:2.2;stroke-linecap:round;fill:none}
.wb-atelier-figure-head{fill:#c7a17c;stroke:rgba(73,49,33,.35);stroke-width:.7}
.wb-atelier-figure-hair{fill:#2b2621}
.wb-atelier-person-label rect{fill:rgba(10,17,12,.7);stroke:rgba(191,211,195,.16);stroke-width:.7}
.wb-atelier-person-label text{fill:rgba(207,224,210,.5);font-size:5px;letter-spacing:.06em}
.wb-atelier-stroller{animation:wbAtelierStroll 19s ease-in-out infinite}
.wb-atelier-pantry{pointer-events:none}
.wb-atelier-pantry-floor{fill:#161f19;stroke:rgba(184,207,190,.14);stroke-width:1}
.wb-atelier-pantry-wall{fill:#0a110d}
.wb-atelier-counter{fill:#3d3224;stroke:rgba(210,185,140,.24);stroke-width:1}
.wb-atelier-coffee{fill:#242d27;stroke:rgba(197,219,202,.28);stroke-width:1}
.wb-atelier-coffee-dot{fill:#c6a56b}
.wb-atelier-cup{fill:none;stroke:rgba(221,224,207,.5);stroke-width:1.2;stroke-linecap:round}
.wb-atelier-steam{fill:none;stroke:rgba(224,230,215,.28);stroke-width:1.4;stroke-linecap:round;stroke-dasharray:2 4;animation:wbAtelierSteam 5s linear infinite}
.wb-atelier-stool{fill:#51432f;stroke:rgba(207,183,140,.22);stroke-width:1}
.wb-atelier-pantry-table{fill:#423727;stroke:rgba(205,181,138,.2);stroke-width:1}
.wb-atelier-pantry-table-line{stroke:rgba(216,196,157,.24);stroke-width:1}
.wb-atelier-pantry-label{fill:rgba(222,210,186,.52);font-size:7px;letter-spacing:.08em}
.wb-atelier-pantry-note{fill:rgba(209,198,176,.28);font-size:5px;letter-spacing:.06em}
.wb-atelier-overview-pantry{pointer-events:none}
.wb-atelier-legend-note{fill:rgba(193,214,198,.34);font-size:5.4px;letter-spacing:.02em}
.wb-atelier-legend{font-size:6px;fill:rgba(197,216,201,.48)}
.wb-atelier-empty-title{fill:rgba(230,239,230,.78);font-size:14px}
.wb-atelier-empty-copy{fill:rgba(197,216,201,.44);font-size:8px}
.wb-atelier-legendbar{position:absolute;z-index:3;left:18px;right:18px;bottom:4px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;pointer-events:none;font-size:8px;color:rgba(205,223,208,.46)}
.wb-atelier-legendbar span{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
.wb-atelier-legendbar i{width:5px;height:5px;border-radius:50%;background:#85988a}
.wb-atelier-legendbar .is-offices i{background:#c4a46d}
.wb-atelier-legendbar .is-workshop i{background:#87b391}
.wb-atelier-legendbar .is-shared i{background:#88a3ad}
.wb-atelier-legendbar .is-intake i{background:#a6a08d}
.wb-atelier-legendbar b{font-weight:500;color:rgba(225,237,226,.7)}
.wb-atelier-legendbar-note{margin-left:auto;color:rgba(198,217,202,.28);font-size:7px}
.wb-atelier-roombar{position:absolute;z-index:9;left:16px;right:16px;top:11px;display:flex;align-items:center;gap:12px;min-height:38px;padding:5px 8px 5px 0;background:linear-gradient(180deg,rgba(8,14,10,.9),rgba(8,14,10,.32));border-bottom:1px solid rgba(188,210,193,.12);pointer-events:auto}
.wb-atelier-back{appearance:none;border:1px solid rgba(193,214,197,.22);background:rgba(37,53,44,.3);color:rgba(224,237,225,.74);font:inherit;font-size:9px;padding:6px 8px;cursor:pointer;white-space:nowrap}
.wb-atelier-back:hover,.wb-atelier-back:focus-visible{border-color:rgba(217,231,216,.58);color:#f3f8f0;outline:none}
.wb-atelier-roombar-title{display:flex;align-items:baseline;gap:7px;min-width:0;flex:1 1 auto;overflow:hidden}
.wb-atelier-roombar-title span{font-size:8px;letter-spacing:.12em;color:rgba(211,189,147,.6)}
.wb-atelier-roombar-title strong{font-size:12px;font-weight:500;color:rgba(238,245,236,.9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-atelier-roombar-title small{font-size:8px;color:rgba(204,224,209,.42);white-space:nowrap}
.wb-atelier-tabs{display:flex;align-items:center;gap:2px;flex:0 1 auto;min-width:0;max-width:45%;overflow-x:auto}
.wb-atelier-tabs button{flex:0 0 auto}
.wb-atelier-tabs button{appearance:none;border:1px solid transparent;background:transparent;color:rgba(205,224,210,.48);font:inherit;font-size:8px;padding:4px 6px;cursor:pointer}
.wb-atelier-tabs button:hover,.wb-atelier-tabs button:focus-visible{border-color:rgba(205,224,210,.3);color:#edf5eb;outline:none}
.wb-atelier-tabs button.is-current{border-color:rgba(214,190,139,.55);background:rgba(100,78,43,.25);color:#f1dfc1}
.wb-atelier-room-plaque{fill:rgba(8,15,11,.68);stroke:rgba(193,214,197,.16);stroke-width:1}
.wb-atelier-room-aisle{stroke:rgba(195,216,200,.1);stroke-width:1;stroke-dasharray:3 7}
.wb-atelier-room-note{fill:rgba(194,214,198,.3);font-size:5.4px}
.wb-atelier-desk{cursor:pointer;outline:none}
.wb-atelier-desk-shadow{fill:rgba(0,0,0,.3)}
.wb-atelier-desk-top{fill:#5b4c38;stroke:rgba(226,205,170,.24);stroke-width:1;transition:fill .15s ease,stroke .15s ease}
.wb-atelier-desk:hover .wb-atelier-desk-top,.wb-atelier-desk:focus-visible .wb-atelier-desk-top{fill:#6c5a43;stroke:rgba(239,220,187,.58)}
.wb-atelier-desk-screen{fill:#15231b;stroke:rgba(154,190,166,.3);stroke-width:.8}
.wb-atelier-desk.is-running .wb-atelier-desk-screen{fill:#2b5e43;stroke:rgba(151,210,171,.55);filter:drop-shadow(0 0 3px rgba(118,192,142,.3))}
.wb-atelier-desk-paper{fill:rgba(223,216,190,.28)}
.wb-atelier-desk-keyboard{fill:rgba(19,29,23,.8);stroke:rgba(168,194,174,.18);stroke-width:.5}
.wb-atelier-desk-name{fill:rgba(226,239,226,.82);font-size:8.2px;letter-spacing:.02em;pointer-events:none}
.wb-atelier-desk.is-active .wb-atelier-desk-top{fill:#746044;stroke:rgba(238,211,158,.95);stroke-width:1.4}
.wb-atelier-desk.is-active .wb-atelier-desk-name{fill:#fbefd0;font-weight:500}
.wb-atelier-desk-focus{fill:none;stroke:rgba(236,211,158,.85);stroke-width:1.2;filter:drop-shadow(0 0 7px rgba(220,186,116,.28))}
.wb-atelier-desk.is-idle .wb-atelier-desk-top{opacity:.84}
@keyframes wbAtelierWalkCorridor{0%,100%{transform:translateX(-210px)}48%{transform:translateX(250px)}54%{transform:translateX(250px)}82%{transform:translateX(-40px)}}
@keyframes wbAtelierWalkRoom{0%,100%{transform:translateY(0)}46%{transform:translateY(126px)}54%{transform:translateY(126px)}82%{transform:translateY(-38px)}}
@keyframes wbAtelierStroll{0%,100%{transform:translateX(0)}35%{transform:translateX(42px)}65%{transform:translateX(42px)}85%{transform:translateX(0)}}
@keyframes wbAtelierSteam{0%{stroke-dashoffset:0;opacity:.15}50%{opacity:.5}100%{stroke-dashoffset:-12;opacity:.12}}
@media (max-width:980px){.wb-atelier-legendbar-note{display:none}.wb-atelier-roombar{left:8px;right:8px;gap:6px}.wb-atelier-roombar-title small{display:none}.wb-atelier-tabs button{padding:4px 5px}}
@media (max-width:760px){
  .wb-studio-plan.wb-atelier-plan{position:absolute;left:50%;top:50%;display:block;width:1040px;height:600px;margin-left:-520px;margin-top:-300px;padding:0;transform-origin:center center;background:#0c120f}
  .wb-studio.is-room .wb-studio-plan.wb-atelier-plan{position:absolute;inset:0;width:100%;height:100%;margin:0;transform:none!important}
  .wb-atelier-scene{padding:0}
  .wb-atelier-legendbar{display:none}
  .wb-atelier-roombar{top:5px;min-height:32px}
  .wb-atelier-roombar-title strong{font-size:10px}
  .wb-atelier-back{font-size:8px;padding:5px 6px}
}
@media (prefers-reduced-motion:reduce){.wb-atelier-stroller,.wb-atelier-walker,.wb-atelier-steam{animation:none!important}.wb-atelier-desk,.wb-atelier-wing-floor{transition:none}}

/* Office artwork is drawn from small geometric pieces; it needs no remote assets. */
.wb-atelier-plan{background:#17252c!important}
.wb-atelier-svg{shape-rendering:crispEdges}
.wb-atelier-room-floor{fill:#b49872;stroke:#51483d;stroke-width:5}
.wb-atelier-wing-floor{fill:#c5a67d;stroke:#79644f;stroke-width:3}
.wb-atelier-wing.is-workshop .wb-atelier-wing-floor{fill:#c6b18f}
.wb-atelier-wing.is-shared .wb-atelier-wing-floor{fill:#bda886}
.wb-atelier-wing.is-intake .wb-atelier-wing-floor{fill:#ad9b82}
.wb-atelier-wing:hover .wb-atelier-wing-floor,.wb-atelier-wing:focus-visible .wb-atelier-wing-floor{fill:#d8bb91;stroke:#f2d194}
.wb-atelier-wing.has-active .wb-atelier-wing-floor{stroke:#f1d295}
.wb-atelier-wing-wall{fill:#657f7b;stroke:#344c4b;stroke-width:3}
.wb-atelier-wing-side{fill:#526b68;stroke:#344c4b;stroke-width:3}
.wb-atelier-wing-bottom{stroke:#526b68;stroke-width:6}
.wb-atelier-room-sidewall{stroke:#526b68}
.wb-atelier-room-bottomwall{fill:#526b68;stroke:#344c4b}
.wb-atelier-window{fill:#a9d7d2;stroke:#e2e0c9;stroke-width:2}
.wb-atelier-corridor{fill:#a88f72;stroke:#806e59;stroke-width:2}
.wb-atelier-corridor-line{stroke:rgba(247,226,188,.32);stroke-width:1}
.wb-atelier-corridor-label{fill:#4c5a50;font-size:8px}
.wb-atelier-room-rug{fill:#c6b89a;stroke:#ded2b5;stroke-width:3}
.wb-atelier-cabin{fill:rgba(133,164,151,.27);stroke:#779189;stroke-width:2}
.wb-atelier-glass{stroke:#d4e2cd;stroke-width:2}
.wb-atelier-mini-table,.wb-atelier-desk-top{fill:#e4c79c;stroke:#896c53;stroke-width:2}
.wb-atelier-mini-screen,.wb-atelier-desk-screen{fill:#405c64;stroke:#283c45;stroke-width:2}
.wb-atelier-mini-paper,.wb-atelier-desk-paper{fill:#f7ead0}
.wb-atelier-desk-back{fill:#8d7056;stroke:#705844;stroke-width:1}
.wb-atelier-desk-keyboard{fill:#f4eee0;stroke:#aa9a85;stroke-width:1}
.wb-atelier-chair{fill:#58787b;stroke:#364f53;stroke-width:2}
.wb-atelier-desk-name{fill:#3d352d;font-size:13px;font-weight:600;letter-spacing:0;stroke:none}
.wb-office-nameplate{fill:#f6ead2;stroke:#b69774;stroke-width:1}
.wb-office-meeting-floor{fill:#99aca1;stroke:#708b7f;stroke-width:3}
.wb-office-meeting-table{fill:#e2c8a0;stroke:#96775b;stroke-width:3}
.wb-office-meeting-chair{fill:#78958c;stroke:#4b6c63;stroke-width:2}
.wb-office-partition{fill:#e9ddc3;stroke:#8f9b87;stroke-width:3}
.wb-office-partition-glass{fill:#b7d4c9;stroke:#e9ddc3;stroke-width:3}
.wb-atelier-desk.is-active .wb-atelier-desk-top{fill:#f2d39a;stroke:#fff0c8;stroke-width:2.5}
.wb-atelier-desk.is-active .wb-atelier-desk-name{fill:#493a29}
.wb-atelier-desk:hover .wb-atelier-desk-top,.wb-atelier-desk:focus-visible .wb-atelier-desk-top{fill:#f2d6ab;stroke:#fff0c8}
.wb-atelier-desk.is-idle .wb-atelier-desk-top{opacity:1}
.wb-atelier-pantry-floor{fill:#9db3a0;stroke:#657d70;stroke-width:4}
.wb-atelier-pantry-wall{fill:#647d72}
.wb-atelier-counter,.wb-atelier-pantry-table{fill:#e1c59f;stroke:#987b5e;stroke-width:2}
.wb-atelier-fridge{fill:#e5e9d9;stroke:#879c90;stroke-width:2}
.wb-atelier-plant-pot{fill:#b87657;stroke:#744a3c;stroke-width:2}
.wb-atelier-plant-leaf{fill:#629576;stroke:#3d715c;stroke-width:2}
.wb-office-pixel{shape-rendering:crispEdges;pointer-events:none}
.wb-office-step-b{opacity:0}
.wb-office-pixel.is-walking .wb-office-step-a{animation:wbOfficeStepA .65s steps(1,end) infinite}
.wb-office-pixel.is-walking .wb-office-step-b{animation:wbOfficeStepB .65s steps(1,end) infinite}
@keyframes wbOfficeStepA{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes wbOfficeStepB{0%,49%{opacity:0}50%,100%{opacity:1}}
@media (prefers-reduced-motion:reduce){.wb-office-step-a,.wb-office-step-b{animation:none!important}.wb-office-step-a{opacity:1}.wb-office-step-b{opacity:0}}

@media (max-width:1100px){.wb-earth-scenes .wb-scene-label{display:none}.wb-earth-scenes .wb-scene-button{padding:4px 7px}.wb-earth-scenes{flex:0 1 auto}}
@media (max-width:980px){.wb-earth-scenes .wb-scene-button:disabled{display:none}.wb-earth-scenes{gap:3px}.wb-earth-scenes .wb-scene-button{font-size:8px}.wb-library-scenes .wb-scene-button:disabled{display:none}}
.wb-root.is-scene-mode .wb-summary,.wb-root.is-scene-mode .wb-followup-bar,.wb-root.is-scene-mode .wb-tools,.wb-root.is-scene-mode .wb-batchbar,.wb-root.is-scene-mode .wb-footer{display:none}
.wb-root.is-scene-mode .wb-tabs{flex:0 0 auto;margin:0 0 10px;padding-top:1px}
.wb-root.is-scene-mode .wb-tabs .wb-tab{padding-top:8px;padding-bottom:9px;font-size:13px}
.wb-root.is-scene-mode .wb-main{overflow:hidden}
.wb-root.is-scene-mode .wb-shell{height:100%;max-width:1600px;padding:10px 20px 14px;display:flex;flex-direction:column}
.wb-root.is-scene-mode .wb-project-page{flex:1 1 auto;min-height:0;display:flex;flex-direction:column}
.wb-root.is-scene-mode .wb-earth,.wb-root.is-scene-mode .wb-studio,.wb-root.is-scene-mode .wb-library,.wb-root.is-scene-mode .wb-time{flex:1 1 auto;height:100%;min-height:0;max-height:none}
.wb-root.is-scene-mode .wb-earth{display:flex;flex-direction:column;border-top:0}
.wb-root.is-scene-mode .wb-earth-stage{flex:1 1 auto;height:auto;min-height:0;max-height:none}
.wb-root.is-scene-mode .wb-library{padding:0}
.wb-scene-enter{animation:wb-scene-enter .46s var(--wb-ease-out) both}
@keyframes wb-scene-enter{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:none}}
.wb-llib{position:relative;overflow:hidden;color:var(--dsw-alias-label-primary);background:radial-gradient(ellipse at 50% 35%,rgba(107,78,42,.12),transparent 60%),linear-gradient(180deg,#0f0d0a,#090807)}
.wb-llib-top{position:relative;height:84px;display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:18px 22px 0;z-index:3}
.wb-llib-brand{display:flex;gap:12px;align-items:flex-start}
.wb-llib-mark{display:grid;place-items:center;width:34px;height:34px;border:1px solid rgba(213,188,148,.35);border-radius:7px;color:#d9bd8e;background:rgba(64,48,30,.35)}
.wb-llib-brand h1{margin:1px 0 2px;font-family:'Noto Serif SC',serif;font-size:22px;font-weight:500;letter-spacing:.02em}
.wb-llib-brand p{margin:0;color:rgba(222,207,185,.58);font-size:9px;line-height:1.55;max-width:520px}
.wb-llib-head-actions{display:flex;align-items:center;gap:8px;padding-top:4px}
.wb-llib-search{display:flex;align-items:center;gap:7px;width:230px;height:30px;padding:0 10px;border:1px solid rgba(212,188,151,.2);border-radius:5px;background:rgba(17,13,9,.6);color:rgba(220,201,172,.5)}
.wb-llib-search input{flex:1;min-width:0;border:0;outline:0;background:none;color:#efe2cd;font-size:9px}
.wb-llib-exit{display:flex;align-items:center;gap:5px;height:30px;padding:0 9px;border:1px solid rgba(212,188,151,.18);border-radius:5px;background:none;color:rgba(226,209,184,.66);font-size:8px;cursor:pointer}
.wb-llib-scenes{position:absolute;right:22px;top:49px;z-index:4}
.wb-llib-body{position:absolute;inset:88px 0 0;display:grid;grid-template-columns:minmax(0,1fr) 272px;min-height:0}
.wb-llib.is-inspector-collapsed .wb-llib-body{grid-template-columns:minmax(0,1fr)}
.wb-studio.is-inspector-collapsed .wb-studio-body{grid-template-columns:minmax(0,1fr)}
.wb-llib.is-inspector-collapsed .wb-llib-inspector,.wb-studio.is-inspector-collapsed .wb-studio-inspector{display:none}
.wb-scene-details-toggle{appearance:none;flex:none;border:1px solid rgba(212,205,186,.3);border-radius:5px;background:rgba(17,20,17,.8);color:#e9e5d9;font:inherit;font-size:11px;line-height:1.3;padding:5px 8px;cursor:pointer;white-space:nowrap}
.wb-scene-details-toggle:hover,.wb-scene-details-toggle:focus-visible{border-color:#d6ccb0;color:#fff}
.wb-llib-project-index{display:flex;align-items:center;gap:4px;overflow-x:auto;flex:none;padding:8px 0 2px;scrollbar-width:thin}
.wb-llib-project-index>span{flex:none;color:#d4c5af;font-size:11px;padding-right:6px}
.wb-llib-project-index button{flex:none;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:1px solid rgba(212,188,151,.2);border-radius:4px;background:rgba(32,24,17,.7);color:#e7ddcc;padding:5px 8px;font:inherit;font-size:11px;cursor:pointer}
.wb-llib-project-index button[aria-pressed=true]{background:#e3d2b4;color:#282015;border-color:#e3d2b4}
.wb-llib-project-index button:focus-visible{outline:2px solid #f2dfb9;outline-offset:1px}
.wb-llib-stage-wrap{display:flex;flex-direction:column;min-width:0;min-height:0;padding:0 12px 12px 18px}
.wb-llib-stagebar{display:flex;align-items:center;gap:12px;height:38px;flex:none;border-bottom:1px solid rgba(205,181,144,.12)}
.wb-llib-crumb{display:flex;align-items:center;gap:7px;font-size:7.5px;letter-spacing:.1em;text-transform:uppercase;color:rgba(201,179,148,.45);white-space:nowrap}
.wb-llib-crumb b{color:rgba(234,218,193,.75);font-weight:500;letter-spacing:.04em}
.wb-llib-tabs{display:flex;gap:3px;overflow:auto;scrollbar-width:none}
.wb-llib-tab{border:1px solid transparent;background:none;color:rgba(210,190,160,.5);font-size:8px;padding:4px 7px;border-radius:4px;white-space:nowrap;cursor:pointer}
.wb-llib-tab small{opacity:.6;margin-left:3px}
.wb-llib-tab.on{border-color:rgba(216,190,146,.32);background:rgba(95,70,40,.22);color:#ebd7b4}
.wb-llib-count{margin-left:auto;font-size:8px;color:rgba(214,193,162,.45);white-space:nowrap}
.wb-llib-stage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding-top:8px}
.wb-llib-svg{width:100%;height:100%;max-height:100%;display:block;overflow:visible}
.wb-llib-backdrop{fill:transparent}
.wb-llib-floor{stroke:rgba(218,191,149,.2);stroke-width:1}
.wb-llib-planks{opacity:.76;pointer-events:none}
.wb-llib-wall{fill:#17120d;stroke:rgba(218,192,151,.16);stroke-width:1}
.wb-llib-window{stroke:rgba(151,184,196,.45);stroke-width:5;opacity:.6}
.wb-llib-arch{fill:none;stroke:rgba(219,194,154,.24);stroke-width:2}
.wb-llib-arch-inner{fill:none;stroke:rgba(169,196,202,.22);stroke-width:1}
.wb-llib-light{fill:rgba(232,196,132,.05)}
.wb-llib-rug{fill:rgba(76,59,40,.36);stroke:rgba(214,187,146,.13);stroke-width:1}
.wb-llib-wall-base{stroke:rgba(220,195,156,.14);stroke-width:2;fill:none}
.wb-llib-shelf-shadow{fill:rgba(0,0,0,.35)}
.wb-llib-shelf-case{fill:#2c2117;stroke:rgba(219,188,142,.3);stroke-width:1}
.wb-llib-shelf-back{fill:#1a130d}
.wb-llib-shelf-wood{stroke:rgba(236,205,157,.22);stroke-width:1;fill:none}
.wb-llib-shelf-plaque{fill:rgba(20,14,9,.74)}
.wb-llib-shelf-code{fill:#d8b986;font-size:9px;font-weight:600;letter-spacing:.08em}
.wb-llib-shelf-label{fill:rgba(231,213,186,.72);font-size:7px;letter-spacing:.04em}
.wb-llib-shelf-count{fill:rgba(226,204,170,.48);font-size:7px}
.wb-llib-shelf-board{stroke:rgba(198,158,105,.35);stroke-width:2}
.wb-llib-page-button{cursor:pointer;outline:none}
.wb-llib-page-button rect{fill:rgba(20,14,9,.8);stroke:rgba(219,188,142,.35)}
.wb-llib-page-button text,.wb-llib-page-count{fill:rgba(231,213,186,.85);font-size:9px}
.wb-llib-page-button:hover rect,.wb-llib-page-button:focus-visible rect{stroke:#f2d4a5;stroke-width:1.5}
.wb-llib-page-button[aria-disabled="true"]{opacity:.35;cursor:default}
.wb-llib-book{cursor:pointer;outline:none}
.wb-llib-book-hit{pointer-events:all}
.wb-llib-spine{stroke:rgba(24,16,9,.55);stroke-width:.7;transition:filter .15s ease}
.wb-llib-book.is-persistent .wb-llib-spine{fill:#b8874e}
.wb-llib-book.is-incubating .wb-llib-spine{fill:#71865f}
.wb-llib-book.is-temporary .wb-llib-spine{fill:#72838a}
.wb-llib-book.is-unclassified .wb-llib-spine{fill:#8c8073}
.wb-llib-spine-band{stroke:rgba(238,220,190,.28);stroke-width:.8;fill:none}
.wb-llib-book:hover .wb-llib-spine,.wb-llib-book:focus-visible .wb-llib-spine{filter:brightness(1.22)}
.wb-llib-book.is-active .wb-llib-spine{stroke:#f0d6a3;stroke-width:1.4;filter:brightness(1.18)}
.wb-llib-bookmark{fill:#f0cf92;stroke:none}
.wb-llib-catalog-shadow{fill:rgba(0,0,0,.32)}
.wb-llib-catalog-case{fill:#2b2117;stroke:rgba(217,187,143,.3);stroke-width:1}
.wb-llib-catalog-title{fill:rgba(230,209,177,.7);font-size:7px;letter-spacing:.12em}
.wb-llib-drawer{fill:#3c2d1e;stroke:rgba(224,194,149,.22);stroke-width:.8}
.wb-llib-drawer-knob{fill:#d9b77e}
.wb-llib-drawer-label{fill:rgba(229,206,172,.48);font-size:5px}
.wb-llib-globe-stand{fill:#4a3824;stroke:rgba(224,195,149,.3);stroke-width:.8}
.wb-llib-globe{fill:#263b3b;stroke:rgba(182,209,200,.45);stroke-width:1}
.wb-llib-globe-line{stroke:rgba(178,208,196,.42);stroke-width:.7;fill:none}
.wb-llib-ladder-rail{stroke:rgba(205,164,108,.55);stroke-width:2;fill:none}
.wb-llib-ladder-rung{stroke:rgba(205,164,108,.42);stroke-width:1.4}
.wb-llib-table-shadow{fill:rgba(0,0,0,.4)}
.wb-llib-table-top{fill:#3a2c1e;stroke:rgba(231,199,151,.32);stroke-width:1.2}
.wb-llib-table-leather{fill:#1d2a25;stroke:rgba(167,194,177,.16);stroke-width:1}
.wb-llib-table-grain{stroke:rgba(231,199,151,.1);stroke-width:1;fill:none}
.wb-llib-open-page{fill:#e2d4b9;stroke:rgba(97,71,42,.35);stroke-width:.6}
.wb-llib-open-lines{stroke:rgba(88,67,44,.35);stroke-width:.7;fill:none}
.wb-llib-open-spine{stroke:rgba(97,71,42,.3);stroke-width:.8}
.wb-llib-lamp-glow{fill:rgba(242,199,119,.16)}
.wb-llib-lamp-arm{stroke:rgba(223,192,146,.55);stroke-width:1.4;fill:none}
.wb-llib-lamp-shade{fill:#524027;stroke:rgba(240,211,164,.45);stroke-width:.8}
.wb-llib-lamp-bulb{fill:#f0d49a}
.wb-llib-cup path{fill:none;stroke:rgba(231,213,183,.55);stroke-width:1}
.wb-llib-steam{stroke:rgba(231,213,183,.25);stroke-width:.8;animation:wbLibSteam 4s ease-in-out infinite}
.wb-llib-cover-shadow{fill:rgba(0,0,0,.38)}
.wb-llib-cover-empty{fill:#4a3a28;stroke:rgba(238,211,170,.4);stroke-width:1}
.wb-llib-cover-line{stroke:rgba(240,220,190,.28);stroke-width:1;fill:none}
.wb-llib-cover-title{fill:#f1dfc2;font-size:8px;font-family:'Noto Serif SC',serif}
.wb-llib-cover-sub{fill:rgba(235,216,185,.5);font-size:4px}
.wb-llib-cover-ribbon{fill:#a8553f}
.wb-llib-floor-note{fill:rgba(217,194,161,.35);font-size:6px;letter-spacing:.04em}
.wb-llib-no-match{fill:rgba(241,220,188,.62);font-size:15px;font-family:'Noto Serif SC',serif}
.wb-llib-inspector{min-width:0;overflow:auto;padding:14px 18px 24px 14px;border-left:1px solid rgba(208,183,145,.14);background:linear-gradient(180deg,rgba(52,38,24,.18),rgba(15,12,9,.12));scrollbar-width:thin}
.wb-llib-inspector-overline{font-size:7px;letter-spacing:.16em;color:rgba(213,187,148,.46);text-transform:uppercase}
.wb-llib-inspector h2{margin:5px 0 4px;font-family:'Noto Serif SC',serif;font-size:17px;font-weight:500;line-height:1.28}
.wb-llib-path{margin:0 0 10px;color:rgba(209,191,166,.4);font-size:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-llib-cover{position:relative;height:154px;display:grid;place-items:center;margin-bottom:10px;border:1px solid rgba(210,182,143,.16);background:rgba(18,13,9,.45);overflow:hidden}
.wb-llib-cover-image{max-width:100%!important;max-height:100%!important;width:auto!important;height:auto!important;object-fit:contain!important}
.wb-llib-cover-empty{display:flex;flex-direction:column;align-items:center;gap:6px;color:rgba(213,191,160,.45);font-size:7px;text-align:center;padding:10px}
.wb-llib-cover-label{position:absolute;left:6px;bottom:5px;font-size:6px;letter-spacing:.1em;color:rgba(221,199,167,.45);text-transform:uppercase}
.wb-llib-facts{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px}
.wb-llib-facts span{font-size:7px;padding:3px 5px;border:1px solid rgba(213,187,148,.2);border-radius:3px;color:rgba(230,212,184,.68)}
.wb-llib-ledger{display:flex;flex-direction:column;gap:5px;padding:8px 0;border-top:1px solid rgba(210,184,145,.12);border-bottom:1px solid rgba(210,184,145,.12)}
.wb-llib-ledger div{display:flex;justify-content:space-between;gap:8px}
.wb-llib-ledger span{font-size:7px;color:rgba(211,189,157,.45)}
.wb-llib-ledger b{font-size:7.5px;font-weight:500;color:rgba(235,218,190,.72);text-align:right}
.wb-llib-ledger i{height:1px;background:rgba(211,184,145,.08)}
.wb-llib-note{margin:9px 0;font-size:8px;line-height:1.6;color:rgba(225,207,180,.62);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.wb-llib-section-label{display:block;font-size:7px;letter-spacing:.13em;color:rgba(209,184,148,.44);text-transform:uppercase;margin-bottom:4px}
.wb-llib-sessions{margin:8px 0}
.wb-llib-session{display:flex;flex-direction:column;gap:2px;width:100%;padding:5px 0;border:0;border-bottom:1px solid rgba(210,184,145,.08);background:none;text-align:left;cursor:pointer}
.wb-llib-session b{font-size:8px;font-weight:500;color:rgba(235,218,190,.72);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb-llib-session small{font-size:6.5px;color:rgba(208,186,155,.4)}
.wb-llib-session:hover b{color:#f0d7ad}
.wb-llib-no-session{margin:0;font-size:7.5px;line-height:1.5;color:rgba(209,187,157,.4)}
.wb-llib-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.wb-llib-actions .wb-btn{font-size:8px;padding:6px 8px}
.wb-llib-source{margin:9px 0 0;font-size:6.5px;line-height:1.5;color:rgba(196,174,145,.35)}
.wb-llib-inspector-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:8px;text-align:center;color:rgba(215,193,161,.45)}
.wb-llib-inspector-empty b{font-size:11px;font-weight:500;color:rgba(235,217,188,.7)}
.wb-llib-inspector-empty p{font-size:8px;line-height:1.5;max-width:170px}
/* The library uses a separate, warm architectural palette and scene layers. */
.wb-llib-floor{stroke:#75634d;stroke-width:5}
.wb-llib-wall{fill:#7a8a7e;stroke:#50685e;stroke-width:4}
.wb-llib-window{stroke:#d6e8da;stroke-width:5;opacity:.9}
.wb-llib-arch{stroke:#efe4c9;stroke-width:3}
.wb-llib-arch-inner{stroke:#b9d4c8;stroke-width:2}
.wb-llib-light{fill:rgba(255,238,185,.1)}
.wb-llib-rug{fill:#6e8a7d;stroke:#d8cfb4;stroke-width:5}
.wb-llib-wall-base{stroke:#cfb896;stroke-width:4}
.wb-llib-shelf-shadow{fill:rgba(47,37,26,.28)}
.wb-llib-shelf-case{fill:#906c4c;stroke:#604b38;stroke-width:3}
.wb-llib-shelf-back{fill:#5e4c3e}
.wb-llib-shelf-wood{stroke:#ddbd90;stroke-width:3}
.wb-llib-shelf-plaque{fill:#ebd5af;stroke:#a28563;stroke-width:1}
.wb-llib-shelf-code{fill:#615040;font-size:11px;letter-spacing:0}
.wb-llib-shelf-label{fill:#4a3d31;font-size:11px;font-weight:600;letter-spacing:0}
.wb-llib-shelf-count{fill:#594b3d;font-size:10px;font-weight:600}
.wb-llib-shelf-board{stroke:#b7946d;stroke-width:4}
.wb-llib-shelf-edge{fill:#71533b;stroke:#4e3e31;stroke-width:1}
.wb-llib-shelf-top{fill:#c39d73;stroke:#775b43;stroke-width:1}
.wb-llib-book.is-persistent .wb-llib-spine{fill:#c88d55}
.wb-llib-book.is-incubating .wb-llib-spine{fill:#8cad83}
.wb-llib-book.is-temporary .wb-llib-spine{fill:#8ba9ad}
.wb-llib-book.is-unclassified .wb-llib-spine{fill:#b0a296}
.wb-llib-spine-band{stroke:rgba(255,240,213,.65);stroke-width:1}
.wb-llib-spine-name{fill:#26382e;font-size:8px;font-weight:600;pointer-events:none}
.wb-llib-page-button rect{fill:#eedfbe;stroke:#8f765a;stroke-width:1}
.wb-llib-page-button text,.wb-llib-page-count{fill:#473c30;font-size:12px;font-weight:600}
.wb-llib-page-button:hover rect,.wb-llib-page-button:focus-visible rect{stroke:#466a59;stroke-width:2}
.wb-llib-catalog-case{fill:#9c7653;stroke:#6a503c;stroke-width:3}
.wb-llib-catalog-title{fill:#f6e8ce;font-size:10px;letter-spacing:.04em}
.wb-llib-drawer{fill:#c8a77c;stroke:#87694e;stroke-width:1}
.wb-llib-drawer-label{fill:#5b4938;font-size:6px}
.wb-llib-table-top{fill:#ae8864;stroke:#72553d;stroke-width:3}
.wb-llib-table-leather{fill:#58786b;stroke:#b8c6a6;stroke-width:2}
.wb-llib-table-grain{stroke:rgba(255,238,207,.32);stroke-width:2}
.wb-llib-open-page{fill:#f9efd7;stroke:#b89e7b;stroke-width:1}
.wb-llib-open-lines{stroke:#b2a182;stroke-width:1}
.wb-llib-title-on-table{fill:#f9edcf;font-size:14px;font-weight:600;letter-spacing:.02em}
.wb-llib-seat{fill:#b48b66;stroke:#72563f;stroke-width:3}
.wb-llib-seat-cushion{fill:#c7a885;stroke:#e2cbac;stroke-width:1}
.wb-llib-window-glow{fill:#f7e6b7;opacity:.18;pointer-events:none;animation:wbLibraryLight 7s ease-in-out infinite}
.wb-llib-floor-note{fill:#554b3e;font-size:7px;letter-spacing:0}
@keyframes wbLibraryLight{0%,100%{opacity:.14}50%{opacity:.23}}
@keyframes wbLibSteam{0%,100%{opacity:.2;transform:translateY(0)}50%{opacity:.5;transform:translateY(-3px)}}
@media (prefers-reduced-motion:reduce){.wb-llib-steam,.wb-llib-window-glow{animation:none}}
@media (max-width:1100px){.wb-llib-body{grid-template-columns:minmax(0,1fr) 250px}.wb-llib-brand p{max-width:400px}}
@media (max-width:980px){
  .wb-root.is-library-scene .wb-library{height:auto;min-height:0;padding-bottom:10px}
  .wb-llib-top{height:auto;flex-wrap:wrap;padding:12px 14px 0;gap:8px}
  .wb-llib-head-actions{width:100%;padding-top:0}
  .wb-llib-search{flex:1 1 auto;width:auto}
  .wb-llib-scenes{position:static;margin:8px 14px 0}
  .wb-llib-body{position:relative;inset:auto;display:flex;flex-direction:column}
  .wb-llib-stage-wrap{height:560px;flex:none;padding:0 10px 10px}
  .wb-llib-stagebar{height:auto;min-height:38px;flex-wrap:wrap;padding:5px 0;gap:6px}
  .wb-llib-crumb{width:100%}
  .wb-llib-inspector{border-left:0;border-top:1px solid rgba(208,183,145,.14);padding:14px}
}
@media (max-width:620px){
  .wb-llib-stage-wrap{height:430px;padding:0 4px 8px}
  .wb-llib-brand h1{font-size:18px}
  .wb-llib-brand p{display:none}
  .wb-llib-crumb span{display:none}
  .wb-llib-tabs{order:3;width:100%}
  .wb-llib-count{margin-left:0}
  .wb-llib-top{padding:10px 10px 0}
  .wb-llib-scenes{margin:8px 10px 0}
}
/* Preserve the scene's width instead of shrinking it to the available height.
   Small windows scroll the scene, leaving the text index and tools available. */
.wb-llib-stage{display:block;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;min-height:0}
.wb-llib-stage:focus-visible{outline:2px solid #d7be92;outline-offset:-2px}
.wb-llib-svg{display:block;flex:none;width:100%;height:auto;max-height:none;min-width:720px;aspect-ratio:1040/600}


.wb-time{position:relative;height:calc(100vh - 380px);min-height:520px;max-height:760px;overflow:hidden;color:#eee7d9;background:radial-gradient(900px 560px at 72% 43%,rgba(175,144,93,.1),transparent 66%),linear-gradient(145deg,#0c1210 0%,#11130f 52%,#0c0d0b 100%)}
.wb-time *{box-sizing:border-box}
.wb-time-top{position:absolute;z-index:10;left:0;right:0;top:0;display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:14px 20px 10px;pointer-events:none;background:linear-gradient(180deg,rgba(10,14,12,.96),rgba(10,14,12,.66) 58%,transparent)}
.wb-time-brand{display:flex;gap:11px;align-items:flex-start}
.wb-time-mark{display:grid;place-items:center;width:31px;height:31px;border:1px solid rgba(190,159,116,.42);color:#d8b986;background:rgba(93,66,35,.14)}
.wb-time-overline{font-size:7px;line-height:1.2;letter-spacing:.16em;text-transform:uppercase;color:rgba(216,185,134,.58)}
.wb-time-top h1{margin:3px 0;font-size:24px;line-height:1.08;font-weight:500;letter-spacing:-.035em;color:#eef5ec}
.wb-time-top p{margin:0;max-width:620px;font-size:9px;line-height:1.6;color:rgba(208,226,213,.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-time-head-actions{display:flex;align-items:center;gap:8px;flex:0 0 auto;pointer-events:auto}
.wb-time-exit{display:inline-flex;align-items:center;gap:5px;border:1px solid rgba(213,191,161,.22);background:rgba(19,15,11,.26);color:rgba(238,226,207,.62);font:inherit;font-size:9px;padding:7px 9px;cursor:pointer;white-space:nowrap}
.wb-time-exit:hover,.wb-time-exit:focus-visible{border-color:rgba(225,199,156,.55);color:#f4e3c9;outline:none}
.wb-time-search{display:flex;align-items:center;gap:6px;flex:0 1 280px;min-width:180px;border:1px solid rgba(213,191,161,.24);padding:0 9px;background:rgba(19,15,11,.3);color:rgba(226,212,192,.55);pointer-events:auto}
.wb-time-search:focus-within{border-color:rgba(225,199,156,.58)}
.wb-time-search input{border:0;background:transparent;padding:8px 0;min-width:0;width:100%;color:#eee3d1;font:inherit;font-size:10px;outline:none}
.wb-time-scenes{position:absolute;z-index:11;left:20px;top:76px;display:flex;flex-wrap:wrap;gap:5px;align-items:center;margin:0}
.wb-time .wb-scene-button{border-color:rgba(198,179,142,.24);background:rgba(37,48,40,.28);color:rgba(232,224,207,.7);font-size:10px;padding:6px 10px}
.wb-time .wb-scene-button.is-current{border-color:rgba(221,199,159,.76);color:#f6e8cd;background:rgba(83,68,43,.38)}
.wb-time-body{position:absolute;inset:0;display:grid;grid-template-columns:minmax(0,1fr) 330px;min-height:0}
.wb-time-stage-wrap{position:relative;min-width:0;min-height:0;display:flex;flex-direction:column;padding:96px 18px 12px 22px}
.wb-time-stagebar{position:relative;z-index:3;display:flex;align-items:center;gap:12px;min-height:28px;flex-wrap:wrap}
.wb-time-crumb{display:flex;align-items:baseline;gap:8px;min-width:0}
.wb-time-crumb span{font-size:7px;letter-spacing:.13em;color:rgba(216,185,134,.54);white-space:nowrap;text-transform:uppercase}
.wb-time-crumb b{font-size:11px;font-weight:500;color:rgba(238,231,217,.82);white-space:nowrap}
.wb-time-buckets{display:flex;align-items:center;gap:2px;flex-wrap:wrap;min-width:0}
.wb-time-bucket{display:inline-flex;align-items:baseline;gap:4px;padding:4px 6px;border:1px solid transparent;background:transparent;color:rgba(225,216,199,.48);font:inherit;font-size:8px;line-height:1;cursor:pointer;white-space:nowrap}
.wb-time-bucket:hover,.wb-time-bucket:focus-visible{border-color:rgba(224,199,158,.32);color:#f0dfc2;outline:none}
.wb-time-bucket.on{border-color:rgba(220,190,140,.42);background:rgba(102,76,40,.2);color:#f0d9b5}
.wb-time-bucket small{font-size:7px;color:rgba(226,211,191,.4)}
.wb-time-tools{margin-left:auto;display:flex;align-items:center;gap:8px}
.wb-time-refresh{display:grid;place-items:center;width:24px;height:22px;border:1px solid rgba(213,191,161,.18);background:rgba(17,22,18,.22);color:rgba(226,211,191,.54);cursor:pointer}
.wb-time-refresh:hover,.wb-time-refresh:focus-visible{border-color:rgba(225,199,156,.5);color:#f1dfc4;outline:none}
.wb-time-count{font-size:8px;color:rgba(226,211,191,.46);white-space:nowrap}
.wb-time-stage{position:relative;flex:1;min-height:0;display:grid;place-items:center;overflow:hidden;border-top:1px solid rgba(180,204,188,.12);border-bottom:1px solid rgba(180,204,188,.1);background:radial-gradient(ellipse at 50% 50%,rgba(211,180,120,.06),transparent 62%)}
.wb-time-spiral{display:block;width:100%;height:100%;min-height:0;overflow:visible}
.wb-time-orbit{fill:none;stroke:rgba(190,170,132,.13);stroke-width:1;stroke-dasharray:2 8}
.wb-time-orbit.is-outer{stroke:rgba(190,170,132,.2);stroke-dasharray:1 12}
.wb-time-orbit.is-inner{stroke:rgba(214,186,137,.2)}
.wb-time-coil{fill:none;stroke:rgba(203,177,127,.44);stroke-width:1.2;stroke-linecap:round;filter:drop-shadow(0 0 6px rgba(203,177,127,.12))}
.wb-time-core{fill:#e8ce9e;filter:drop-shadow(0 0 8px rgba(232,206,158,.55))}
.wb-time-axis-label{fill:rgba(222,211,190,.44);font-size:9px;letter-spacing:.12em}
.wb-time-axis-label.is-muted{fill:rgba(222,211,190,.32);font-size:8px}
.wb-time-dot{cursor:pointer;outline:none}
.wb-time-dot-halo{fill:rgba(194,174,137,.08);stroke:rgba(194,174,137,.24);stroke-width:1;transition:fill .18s ease,stroke .18s ease,r .18s ease}
.wb-time-dot-core{fill:#a99673;transition:fill .18s ease,r .18s ease}
.wb-time-dot.is-today .wb-time-dot-core{fill:#efd39c}
.wb-time-dot.is-week .wb-time-dot-core{fill:#d8c49d}
.wb-time-dot.is-month .wb-time-dot-core{fill:#b6b395}
.wb-time-dot.is-quarter .wb-time-dot-core{fill:#93a292}
.wb-time-dot.is-year .wb-time-dot-core{fill:#78867d}
.wb-time-dot.is-older .wb-time-dot-core{fill:#56615b}
.wb-time-dot.is-unknown .wb-time-dot-core{fill:#aaa4a0}
.wb-time-dot:hover .wb-time-dot-halo,.wb-time-dot:focus-visible .wb-time-dot-halo{fill:rgba(232,206,158,.16);stroke:rgba(232,206,158,.65)}
.wb-time-dot.is-active .wb-time-dot-halo{fill:rgba(232,206,158,.2);stroke:rgba(244,224,183,.82)}
.wb-time-dot.is-active .wb-time-dot-core{fill:#f4dfb5;filter:drop-shadow(0 0 7px rgba(244,223,181,.6))}
.wb-time-active-label{pointer-events:none}
.wb-time-label-line{stroke:rgba(240,216,176,.48);stroke-width:1}
.wb-time-label-name{fill:#f0dfc2;font-size:11px;letter-spacing:.01em}
.wb-time-label-time{fill:rgba(226,211,191,.52);font-size:8px}
.wb-time-start-mark{fill:rgba(255,244,218,.8)}
.wb-time-legend{position:absolute;left:16px;right:16px;bottom:10px;display:flex;gap:16px;flex-wrap:wrap;font-size:8px;color:rgba(226,211,191,.42);pointer-events:none}
.wb-time-legend span{display:inline-flex;align-items:center;gap:5px}
.wb-time-legend i{display:block;width:5px;height:5px;border-radius:50%;background:#a99673}
.wb-time-legend i.is-recent{background:#efd39c}
.wb-time-legend i.is-old{background:#56615b}
.wb-time-legend i.is-unknown{background:#aaa4a0}
.wb-time-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;color:rgba(226,211,191,.46);font-size:10px;text-align:center;padding:24px}
.wb-time-empty b{font-size:13px;font-weight:500;color:rgba(238,231,217,.75)}
.wb-time-empty span{max-width:320px;line-height:1.6}
.wb-time-unknown-note{margin:6px 2px 0;font-size:8px;line-height:1.5;color:rgba(226,211,191,.4)}
.wb-time-rail{display:flex;flex-direction:column;min-height:0;padding-top:112px;border-left:1px solid rgba(180,204,188,.14);background:linear-gradient(180deg,rgba(13,18,15,.66),rgba(10,12,10,.3))}
.wb-time-index{display:flex;flex-direction:column;flex:1 1 auto;min-height:0;border-bottom:1px solid rgba(180,204,188,.14)}
.wb-time.has-active .wb-time-index{flex:0 0 38%}
.wb-time-index-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:8px 16px 7px;border-bottom:1px solid rgba(180,204,188,.1)}
.wb-time-index-head span{font-size:9px;letter-spacing:.1em;color:rgba(238,231,217,.76)}
.wb-time-index-head small{font-size:7px;color:rgba(226,211,191,.42);white-space:nowrap}
.wb-time-index-list{min-height:0;overflow:auto;padding:2px 8px 8px 14px}
.wb-time-row{display:grid;grid-template-columns:24px minmax(0,1fr) 9px;align-items:center;gap:7px;min-height:38px;padding:5px 5px 5px 0;border-bottom:1px solid rgba(180,204,188,.08);cursor:pointer;outline:none}
.wb-time-row:hover,.wb-time-row:focus-visible{background:rgba(213,180,126,.06)}
.wb-time-row.is-active{background:rgba(213,180,126,.1);box-shadow:inset 2px 0 0 rgba(224,193,143,.72)}
.wb-time-row-index{font:8px/1 ui-monospace,SFMono-Regular,Consolas,monospace;color:rgba(216,185,134,.38)}
.wb-time-row-main{display:flex;flex-direction:column;gap:3px;min-width:0}
.wb-time-row-main b{font-size:10px;font-weight:500;line-height:1.2;color:rgba(238,231,217,.86);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-time-row-main small{font-size:7.5px;line-height:1.2;color:rgba(226,211,191,.44);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-time-row-dot{width:5px;height:5px;border-radius:50%;background:#a99673}
.wb-time-row-dot.is-today{background:#efd39c}.wb-time-row-dot.is-week{background:#d8c49d}.wb-time-row-dot.is-month{background:#b6b395}.wb-time-row-dot.is-quarter{background:#93a292}.wb-time-row-dot.is-year{background:#78867d}.wb-time-row-dot.is-older{background:#56615b}.wb-time-row-dot.is-unknown{background:#aaa4a0}
.wb-time-index-empty{margin:0;padding:22px 10px;font-size:10px;color:rgba(226,211,191,.46)}
.wb-time-inspector{flex:1;min-height:0;overflow:auto;padding:14px 17px 18px}
.wb-time-inspector-head{min-width:0}
.wb-time-inspector-head h2{margin:5px 0 4px;font-size:22px;line-height:1.08;font-weight:500;letter-spacing:-.03em;color:#f2eadc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-time-path{margin:0 0 10px;font:8.5px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;color:rgba(226,211,191,.42);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-time-media{position:relative;margin:0 0 9px;border:1px solid rgba(213,191,161,.16);background:rgba(12,15,12,.35)}
.wb-time-media-image{display:block;width:100%;height:102px;object-fit:cover;opacity:.9}
.wb-time-media-empty{display:flex;align-items:center;justify-content:center;gap:7px;height:72px;padding:10px;font-size:8px;line-height:1.45;color:rgba(226,211,191,.42);text-align:center}
.wb-time-media-label{position:absolute;left:7px;bottom:6px;padding:2px 4px;background:rgba(8,11,9,.72);font-size:7px;letter-spacing:.08em;color:rgba(238,222,193,.62)}
.wb-time-facts{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 12px}
.wb-time-fact{padding:3px 5px;border:1px solid rgba(180,204,188,.16);font-size:8px;line-height:1.25;color:rgba(226,211,191,.56)}
.wb-time-fact.is-life{border-color:rgba(213,181,139,.3);color:rgba(240,215,177,.78)}
.wb-time-ledger{display:grid;grid-template-columns:minmax(0,1fr) 12px minmax(0,1.5fr);align-items:center;gap:6px;padding:10px 0;border-top:1px solid rgba(180,204,188,.12);border-bottom:1px solid rgba(180,204,188,.12)}
.wb-time-ledger>div{display:flex;flex-direction:column;gap:4px;min-width:0}
.wb-time-ledger span{font-size:7px;letter-spacing:.08em;color:rgba(226,211,191,.4);text-transform:uppercase}
.wb-time-ledger b{font:10px/1.3 ui-monospace,SFMono-Regular,Consolas,monospace;font-weight:400;color:rgba(238,231,217,.78);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-time-ledger i{display:block;height:1px;background:rgba(213,181,139,.38);position:relative}
.wb-time-ledger i:after{content:'';position:absolute;right:0;top:-2px;width:5px;height:5px;border-radius:50%;background:#d9bd8c}
.wb-time-no-date{margin:8px 0 0;font-size:8px;line-height:1.5;color:rgba(226,211,191,.44)}
.wb-time-session{display:flex;flex-direction:column;gap:3px;margin:11px 0 0}
.wb-time-session span{font-size:7px;letter-spacing:.08em;color:rgba(226,211,191,.4);text-transform:uppercase}
.wb-time-session b{font-size:10px;font-weight:500;line-height:1.35;color:rgba(238,231,217,.8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-time-session small{font-size:7.5px;color:rgba(226,211,191,.42)}
.wb-time-no-session{margin:11px 0 0;font-size:8px;color:rgba(226,211,191,.4)}
.wb-time-actions{display:flex;flex-wrap:wrap;gap:5px;margin-top:13px}
.wb-time-actions .wb-btn{font-size:9px;padding:7px 9px}
.wb-time-source{margin:11px 0 0;font-size:7.5px;line-height:1.55;color:rgba(226,211,191,.38)}
.wb-time:not(.has-active) .wb-time-inspector{flex:0 0 auto;border-top:1px solid rgba(180,204,188,.14);padding:10px 17px 13px}
.wb-time:not(.has-active) .wb-time-inspector-empty{padding:0}
.wb-time-inspector-empty{padding:18px 0}
.wb-time-inspector-empty p{margin:8px 0 0;font-size:10px;line-height:1.7;color:rgba(226,211,191,.48)}
.wb-time.is-entering .wb-time-stage{opacity:.24;transform:scale(.985);transition:opacity .26s ease,transform .26s ease}
.wb-time.is-entering .wb-time-rail{opacity:.55;transition:opacity .26s ease}
.wb-time.is-entering .wb-time-dot.is-active .wb-time-dot-halo{fill:rgba(244,224,183,.34);stroke:rgba(255,239,204,.95)}
.wb-time-dot{transition:opacity .26s ease}
@media (max-width:1180px){.wb-time-body{grid-template-columns:minmax(0,1fr) 286px}.wb-time-top h1{font-size:23px}.wb-time-top p{max-width:500px}.wb-time-search{flex:0 1 220px}.wb-time-index-head small{display:none}}
@media (max-width:980px){.wb-root.is-scene-mode .wb-main{overflow:auto}.wb-root.is-scene-mode .wb-shell{height:auto;min-height:100%}.wb-root.is-scene-mode .wb-earth,.wb-root.is-scene-mode .wb-studio,.wb-root.is-scene-mode .wb-library,.wb-root.is-scene-mode .wb-time{height:auto;min-height:0}.wb-root.is-scene-mode .wb-earth-stage{height:calc(100vh - 390px);min-height:500px}.wb-root.is-studio-scene .wb-studio{height:auto;min-height:0}.wb-root.is-time-scene .wb-time{height:auto;min-height:0;max-height:none}.wb-time{height:auto;min-height:100%;overflow:auto}.wb-time-top{position:relative;flex-direction:column;gap:8px;padding:10px 2px 8px;background:none;pointer-events:auto}.wb-time-top p{white-space:normal;font-size:9px;max-width:640px}.wb-time-head-actions{width:100%}.wb-time-search{flex:1 1 auto;width:auto}.wb-time-scenes{position:static;margin:0 0 8px}.wb-time-body{position:relative;inset:auto;display:flex;flex-direction:column;min-height:0}.wb-time-stage-wrap{height:560px;flex:none;padding:0 12px 12px}.wb-time-rail{padding-top:0;border-left:0;border-top:1px solid rgba(180,204,188,.14)}.wb-time-index{flex:0 0 auto;max-height:310px}.wb-time-inspector{flex:0 0 auto;overflow:visible;padding-bottom:24px}.wb-time-crumb span{display:none}}
@media (max-width:620px){.wb-time-top h1{font-size:22px}.wb-time-stage-wrap{height:440px}.wb-time-stagebar{gap:6px}.wb-time-buckets{gap:1px}.wb-time-bucket{font-size:7.5px;padding:4px 4px}.wb-time-count{display:none}.wb-time-legend{gap:9px;font-size:7px;bottom:6px}.wb-time-crumb b{font-size:10px}.wb-time-inspector-head h2{font-size:20px}.wb-time-media-image{height:86px}}
@media (prefers-reduced-motion:reduce){.wb-time.is-entering .wb-time-stage,.wb-time.is-entering .wb-time-rail,.wb-time-dot,.wb-time-dot-halo,.wb-time-dot-core{transition:none}}
.wb-contract-row{display:grid;grid-template-columns:44px minmax(0,1fr);gap:8px;padding:7px 0;border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-border-l1) 58%,transparent);font-size:10.5px;line-height:1.55}
.wb-contract-row b{font-weight:500;color:var(--dsw-alias-label-tertiary);font-size:9px;letter-spacing:.03em}
.wb-contract-row span{color:var(--dsw-alias-label-secondary);word-break:break-word;max-height:96px;overflow:auto}
.wb-contract-hint{margin:8px 0 0;font-size:8.5px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}
@media (max-width:1100px){.wb-earth-intro{max-width:270px}.wb-earth-inspector{width:242px}.wb-earth-caption{display:none}}
@media (max-width:980px){.wb-earth-wheel-hint{display:none}.wb-earth-stage{height:calc(100vh - 440px);min-height:520px;max-height:none}.wb-earth-intro{left:20px;top:84px;max-width:250px}.wb-earth-intro h1{font-size:25px}.wb-earth-top{left:16px;right:16px;top:14px;gap:8px}.wb-earth-caption,.wb-earth-clock{display:none}.wb-earth-actions{gap:5px}.wb-earth-control{padding:4px 7px;font-size:9px}.wb-earth-intro{display:none}.wb-earth-inspector{left:18px;right:18px;top:auto;bottom:48px;width:auto;max-height:320px;overflow:auto;padding:12px 16px 0;border-left:0;border-top:1px solid rgba(218,234,240,.22);background:linear-gradient(180deg,rgba(5,13,18,.97),rgba(3,9,13,.99));backdrop-filter:blur(12px)}.wb-earth-inspector .wb-anchor-media-button{width:210px;max-width:44%;float:left;margin:0 12px 8px 0}.wb-earth-inspector .wb-anchor-media-meta{margin-top:0}.wb-earth-inspector .wb-earth-actions-row{clear:both}.wb-earth-inspector .wb-anchor-record,.wb-earth-inspector .wb-anchor-links{display:none}.wb-earth-zoombar{right:16px;bottom:260px}.wb-earth-bottom{left:18px;right:18px;bottom:14px;font-size:7px;gap:9px}.wb-earth-index{left:16px;right:16px;width:auto;top:86px;max-height:calc(100% - 240px)}.wb-earth-inspector .wb-earth-note{display:none}.wb-earth-inspector .wb-earth-disclaimer{margin-top:6px}.wb-earth-inspector h2{font-size:23px;margin:4px 0 6px}.wb-earth-actions-row{margin-top:8px}.wb-earth-credit{padding-left:16px;padding-right:16px;font-size:7px}}
@media (max-width:980px){.wb-earth-landing-note{left:16px;right:16px;top:58px;max-width:none;padding:8px 10px}.wb-earth-landing-note small{display:none}}
@media (max-width:980px){.wb-earth-index.is-deck{left:12px;right:12px;top:auto;bottom:42px;width:auto;max-height:min(46%,300px);padding:11px 12px 9px}.wb-earth-index-list{grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px}.wb-earth-index-hint{display:none}.wb-earth-focus-hint{display:none}.wb-earth-stage.is-panorama .wb-earth-index.is-deck{left:10px;right:10px;top:auto;bottom:10px;width:auto;max-height:min(270px,48vh);padding:10px 12px 8px}.wb-earth-stage.is-panorama .wb-earth-index.is-deck .wb-earth-project-card{flex-basis:190px;width:190px;min-height:102px}}
@media (max-width:980px){.wb-earth.is-landing .wb-earth-inspector{left:18px;right:18px;top:auto;bottom:48px;width:auto;max-height:320px;padding:12px 16px 0;border-left:0;border-top:1px solid rgba(243,217,182,.3);background:linear-gradient(180deg,rgba(5,13,18,.98),rgba(3,9,13,.99));box-shadow:none}}
@media (min-width:981px){.wb-earth.is-landing .wb-earth-landing-note{display:none}}
@media (max-width:980px){.wb-earth.is-landing .wb-earth-inspector.is-map-card{left:18px!important;right:18px!important;top:auto!important;bottom:48px!important;width:auto!important;max-height:340px!important;border-radius:16px;border:1px solid rgba(243,217,182,.3);padding:12px 16px 10px;animation:none;overflow-y:auto;overflow-x:hidden}.wb-earth.is-landing .wb-earth-inspector.is-map-card .wb-earth-card-tail{display:none!important}.wb-earth.is-landing .wb-earth-inspector.is-map-card .wb-earth-card-actions{padding:8px 0;margin:8px 0 0}.wb-earth.is-landing .wb-earth-inspector.is-map-card .wb-earth-card-hint{display:none}.wb-earth.is-landing .wb-earth-inspector.is-map-card h2{font-size:22px}.wb-earth.is-landing .wb-earth-inspector.is-map-card .wb-anchor-media{margin:8px 0 0}.wb-earth.is-landing .wb-earth-inspector.is-map-card .wb-anchor-media-button{float:none;width:100%;max-width:none;height:118px;aspect-ratio:auto;margin:0}.wb-earth.is-landing .wb-earth-inspector.is-map-card .wb-anchor-media-meta{display:none}}
@media (min-width:640px) and (max-width:980px){.wb-earth.is-landing .wb-earth-inspector .wb-anchor-record{display:block;margin-left:222px}.wb-earth.is-landing .wb-earth-inspector .wb-earth-note{display:block;margin-left:222px}}
@media (max-width:640px){.wb-earth.is-landing .wb-earth-inspector .wb-anchor-record{display:block;margin-left:222px}.wb-earth.is-landing .wb-earth-inspector .wb-earth-note{display:block;margin-left:222px}}
@media (max-width:560px){.wb-earth-stage{min-height:600px}.wb-earth-intro{max-width:210px}.wb-earth-intro p{font-size:10px}.wb-earth-inspector{bottom:42px;max-height:260px}.wb-earth-zoombar{bottom:232px}.wb-earth-landing-note{bottom:312px}}
@media (prefers-reduced-motion:reduce){.wb-earth-marker,.wb-earth-control,.wb-earth-restore{transition:none}.wb-earth-flight-dot{animation:none;opacity:.8}}
.wb-cap{display:flex;flex-direction:column;min-width:0}
.wb-cap-head{padding:10px 0 26px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.wb-cap-head h2{margin:12px 0 8px;font-size:clamp(24px,2.5vw,34px);line-height:1.18;font-weight:560;letter-spacing:-.025em;color:var(--dsw-alias-label-primary)}
.wb-cap-head p{margin:0;max-width:720px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.75}
.wb-cap-mark{display:grid;place-items:center;width:22px;height:22px;border:1px solid var(--dsw-alias-border-l2);border-radius:50%;color:var(--dsw-alias-brand-primary)}
.wb-cap-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-bottom:1px solid var(--dsw-alias-border-l1)}
.wb-cap-metrics>div{display:flex;align-items:baseline;gap:9px;padding:18px 20px 18px 0;min-width:0}
.wb-cap-metrics>div+div{border-left:1px solid var(--dsw-alias-border-l1);padding-left:20px}
.wb-cap-metrics b{font-size:24px;font-weight:520;letter-spacing:-.03em;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}
.wb-cap-metrics span{font-size:11px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-cap-grid{display:grid;grid-template-columns:minmax(0,1.12fr) minmax(0,.88fr);border-bottom:1px solid var(--dsw-alias-border-l1)}
.wb-cap-block{padding:26px 32px 30px 0;min-width:0}
.wb-cap-block+.wb-cap-block{border-left:1px solid var(--dsw-alias-border-l1);padding-left:32px;padding-right:0}
.wb-cap-label{display:flex;align-items:center;gap:9px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary);font-weight:600}
.wb-cap-label>span{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary);opacity:.72}
.wb-cap-block h3{margin:12px 0 8px;font-size:18px;line-height:1.3;font-weight:520;letter-spacing:-.01em;color:var(--dsw-alias-label-primary)}
.wb-cap-block>p{margin:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.75;max-width:460px}
.wb-cap-kv{margin:18px 0 0;display:flex;flex-direction:column;gap:9px}
.wb-cap-kv>div{display:grid;grid-template-columns:82px minmax(0,1fr);gap:12px;align-items:baseline}
.wb-cap-kv dt{font-size:10px;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary)}
.wb-cap-kv dd{margin:0;min-width:0;font-size:12px;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
.wb-cap-kv code{font:11px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--dsw-alias-label-primary);background:transparent;padding:0;overflow-wrap:anywhere}
.wb-cap-actions{display:flex;align-items:center;gap:8px;margin-top:22px;flex-wrap:wrap}
.wb-cap-submit{margin-top:20px;border-top:1px solid var(--dsw-alias-border-l1);padding-top:2px}
.wb-cap-submit>div{display:grid;grid-template-columns:94px minmax(0,1fr);gap:12px;padding:10px 0;border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-border-l1) 60%,transparent);align-items:baseline}
.wb-cap-submit b{font-size:10px;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary);font-weight:500}
.wb-cap-submit span{font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.55}
.wb-cap-submit .is-warn{color:var(--dsw-alias-state-warn-primary)}
.wb-cap-section{padding:26px 0;border-bottom:1px solid var(--dsw-alias-border-l1);min-width:0}
.wb-cap-section:last-child{border-bottom:0;padding-bottom:10px}
.wb-cap-section-sub{margin:9px 0 0;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.65;max-width:760px}
.wb-cap-evidence{margin-top:16px;border-top:1px solid var(--dsw-alias-border-l1)}
.wb-cap-evidence-row{display:grid;grid-template-columns:minmax(110px,.85fr) 96px 112px minmax(0,1.65fr);gap:14px;align-items:center;padding:10px 0;border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-border-l1) 58%,transparent)}
.wb-cap-evidence-name{font-size:12px;color:var(--dsw-alias-label-secondary);min-width:0}
.wb-cap-evidence-row>b{font-size:12px;font-weight:520;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb-cap-state{display:inline-flex;align-items:center;gap:6px;font-size:10px;letter-spacing:.02em;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.wb-cap-state::before{content:"";width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.7}
.wb-cap-state.is-verified{color:var(--dsw-alias-state-success-primary)}
.wb-cap-state.is-discovered{color:var(--dsw-alias-link)}
.wb-cap-state.is-declared{color:var(--dsw-alias-state-warn-primary)}
.wb-cap-state.is-unavailable{color:var(--dsw-alias-label-tertiary)}
.wb-cap-evidence-hint{font-size:11px;line-height:1.55;color:var(--dsw-alias-label-tertiary);min-width:0;overflow:hidden;text-overflow:ellipsis}
.wb-cap-session-list,.wb-cap-skill-list{margin-top:12px;border-top:1px solid var(--dsw-alias-border-l1)}
.wb-cap-session-row{display:grid;grid-template-columns:58px minmax(0,1fr) auto;gap:14px;align-items:center;padding:10px 0;border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-border-l1) 58%,transparent)}
.wb-cap-session-source{font:9px/1 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.1em;color:var(--dsw-alias-label-tertiary)}
.wb-cap-session-title{font-size:12px;color:var(--dsw-alias-label-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-cap-session-role{font-size:10px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.wb-cap-skill-row{display:grid;grid-template-columns:minmax(0,1fr) 72px minmax(0,1.5fr) auto;gap:14px;align-items:center;padding:10px 0;border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-border-l1) 58%,transparent)}
.wb-cap-skill-name{font-size:12px;color:var(--dsw-alias-label-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-cap-skill-origin{font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}
.wb-cap-skill-row code{font:10px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-cap-empty{margin:14px 0 0;padding:16px 0;border-top:1px solid var(--dsw-alias-border-l1);border-bottom:1px solid var(--dsw-alias-border-l1);font-size:12px;line-height:1.7;color:var(--dsw-alias-label-tertiary);max-width:720px}
.wb-cap-handoff{margin-top:14px;border-left:2px solid var(--dsw-alias-border-l2);padding:2px 0 2px 16px;max-width:820px}
.wb-cap-handoff p{margin:0;font-size:13px;line-height:1.8;color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}
.wb-cap-handoff-meta{display:flex;gap:14px;margin-top:10px;font-size:10px;color:var(--dsw-alias-label-tertiary)}
@media (max-width:860px){.wb-cap-grid{grid-template-columns:1fr}.wb-cap-block{padding-right:0}.wb-cap-block+.wb-cap-block{border-left:0;border-top:1px solid var(--dsw-alias-border-l1);padding-left:0;padding-top:24px}.wb-cap-evidence-row{grid-template-columns:minmax(90px,1fr) 60px auto}.wb-cap-evidence-hint{grid-column:1/-1;padding-left:0}.wb-cap-metrics>div{padding-right:10px}.wb-cap-metrics>div+div{padding-left:10px}.wb-cap-metrics b{font-size:20px}}
@media (max-width:560px){.wb-cap-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.wb-cap-metrics>div:nth-child(3){border-left:0;padding-left:0}.wb-cap-metrics>div:nth-child(n+3){border-top:1px solid var(--dsw-alias-border-l1)}.wb-cap-evidence-row{grid-template-columns:minmax(80px,1fr) 42px auto;gap:8px}.wb-cap-session-row{grid-template-columns:48px minmax(0,1fr)}.wb-cap-session-role{display:none}.wb-cap-skill-row{grid-template-columns:minmax(0,1fr) 62px auto}.wb-cap-skill-row code{display:none}.wb-cap-kv>div{grid-template-columns:72px minmax(0,1fr)}}
.wb-terrain{position:relative;border-top:1px solid var(--dsw-alias-border-l1);border-bottom:1px solid var(--dsw-alias-border-l1);background:
  radial-gradient(80% 90% at 100% 0%,color-mix(in srgb,var(--dsw-alias-brand-primary) 5%,transparent),transparent 60%);padding:16px 2px 10px;overflow:hidden}
.wb-terrain-head{display:flex;align-items:center;gap:14px;min-width:0}
.wb-terrain-kicker{display:flex;align-items:center;gap:7px;color:var(--dsw-alias-label-tertiary);font-size:9px;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap}
.wb-terrain-count{margin-left:auto;color:var(--dsw-alias-label-tertiary);font-size:9px;font-variant-numeric:tabular-nums;white-space:nowrap}
.wb-terrain-legend{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.wb-terrain-legend span{display:inline-flex;align-items:center;gap:4px;color:var(--dsw-alias-label-tertiary);font-size:9px;white-space:nowrap}
.wb-terrain-legend i{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-label-tertiary)}
.wb-terrain-legend .is-persistent i{background:#d98a5f}
.wb-terrain-legend .is-incubating i{background:#8ea7ff}
.wb-terrain-legend .is-temporary i{background:#68b79d}
.wb-terrain-legend .is-unclassified i{background:#9b92b7}
.wb-terrain-shell{display:grid;grid-template-columns:minmax(0,1fr) 292px;gap:18px;margin-top:12px;align-items:stretch}
.wb-terrain-plot{position:relative;min-height:500px;outline:none}
.wb-terrain-plot:focus-visible{outline:1px solid var(--dsw-alias-brand-primary);outline-offset:3px;border-radius:6px}
.wb-terrain-bands{position:absolute;left:68px;right:0;top:6px;bottom:34px;pointer-events:none}
.wb-terrain-band{position:absolute;left:0;right:0;height:0;border-top:1px dashed var(--dsw-alias-border-l1)}
.wb-terrain-band span{position:absolute;right:calc(100% + 10px);top:-9px;color:var(--dsw-alias-label-tertiary);font-size:9px;letter-spacing:.12em;white-space:nowrap}
.wb-terrain-field{position:absolute;left:68px;right:0;top:6px;bottom:34px}
.wb-terrain-grid{position:absolute;inset:0;pointer-events:none}
.wb-terrain-grid i{position:absolute;top:0;bottom:0;width:1px;background:var(--dsw-alias-border-l1);opacity:.45}
.wb-terrain-grid i:first-child,.wb-terrain-grid i:last-child{opacity:.15}
.wb-terrain-node{position:absolute;width:calc(var(--r)*2);height:calc(var(--r)*2);padding:0;border:0;border-radius:50%;background:transparent;transform:translate(-50%,-50%);cursor:pointer;isolation:isolate;animation:wb-terrain-node-in .52s var(--wb-ease-out) both;animation-delay:calc(var(--i)*13ms)}
.wb-terrain-dot{position:absolute;inset:0;border-radius:50%;background:color-mix(in srgb,var(--wb-accent) 68%,var(--dsw-alias-bg-layer-1));box-shadow:0 0 0 1px color-mix(in srgb,var(--wb-accent) 85%,transparent),0 0 18px color-mix(in srgb,var(--wb-accent) 20%,transparent);transition:transform var(--wb-dur-fast) var(--wb-ease),box-shadow var(--wb-dur-fast) var(--wb-ease),filter var(--wb-dur-fast) var(--wb-ease)}
.wb-terrain-node.is-life-persistent .wb-terrain-dot{background:color-mix(in srgb,#d98a5f 62%,var(--dsw-alias-bg-layer-1));box-shadow:0 0 0 1px color-mix(in srgb,#d98a5f 82%,transparent),0 0 20px color-mix(in srgb,#d98a5f 20%,transparent)}
.wb-terrain-node.is-life-incubating .wb-terrain-dot{background:color-mix(in srgb,#8ea7ff 58%,var(--dsw-alias-bg-layer-1));box-shadow:0 0 0 1px color-mix(in srgb,#8ea7ff 80%,transparent),0 0 20px color-mix(in srgb,#8ea7ff 18%,transparent)}
.wb-terrain-node.is-life-temporary .wb-terrain-dot{background:color-mix(in srgb,#68b79d 54%,var(--dsw-alias-bg-layer-1));box-shadow:0 0 0 1px color-mix(in srgb,#68b79d 78%,transparent),0 0 18px color-mix(in srgb,#68b79d 16%,transparent)}
.wb-terrain-node.is-life-unclassified .wb-terrain-dot{background:color-mix(in srgb,#9b92b7 50%,var(--dsw-alias-bg-layer-1));box-shadow:0 0 0 1px color-mix(in srgb,#9b92b7 74%,transparent),0 0 16px color-mix(in srgb,#9b92b7 14%,transparent)}
.wb-terrain-node:hover .wb-terrain-dot,.wb-terrain-node.is-hover .wb-terrain-dot{transform:scale(1.16);filter:brightness(1.18);box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-label-primary) 76%,transparent),0 0 28px color-mix(in srgb,var(--dsw-alias-label-primary) 18%,transparent)}
.wb-terrain-node.is-focused{z-index:5}
.wb-terrain-node.is-focused .wb-terrain-dot::after{content:'';position:absolute;inset:-9px;border:1px solid color-mix(in srgb,var(--wb-accent) 65%,transparent);border-radius:50%;animation:wb-terrain-focus-pulse 2.2s var(--wb-ease-out) 2;pointer-events:none}
.wb-terrain-node.is-focused .wb-terrain-dot{box-shadow:0 0 0 2px var(--dsw-alias-label-primary),0 0 0 7px color-mix(in srgb,var(--wb-accent) 18%,transparent),0 0 30px color-mix(in srgb,var(--wb-accent) 40%,transparent);transform:scale(1.12)}
.wb-terrain-node.is-status-running .wb-terrain-dot i{position:absolute;inset:-5px;border:1px solid color-mix(in srgb,var(--wb-accent) 75%,transparent);border-radius:50%;animation:wb-deck-ring 1.8s var(--wb-ease-out) infinite}
.wb-terrain-flag{position:absolute;right:-3px;top:-3px;display:grid;place-items:center;width:13px;height:13px;border-radius:50%;background:var(--dsw-alias-state-warn-primary);color:#1d1712;z-index:2}
.wb-terrain-labels{position:absolute;inset:0;z-index:6;pointer-events:none}
.wb-terrain-label{position:absolute;display:flex;flex-direction:column;gap:1px;min-width:0;color:var(--dsw-alias-label-secondary);font-size:10px;line-height:1.15;white-space:nowrap;overflow:hidden;text-shadow:0 1px 5px var(--dsw-alias-bg-base),0 0 2px var(--dsw-alias-bg-base);pointer-events:none}
.wb-terrain-label b{display:block;overflow:hidden;text-overflow:ellipsis;font-weight:500;letter-spacing:-.012em}
.wb-terrain-label small{display:block;color:var(--dsw-alias-label-tertiary);font-size:8px;font-variant-numeric:tabular-nums;font-weight:400}
.wb-terrain-label.is-right{text-align:right}
.wb-terrain-label.is-focused{color:var(--dsw-alias-label-primary);z-index:7}
.wb-terrain-label.is-focused b{font-weight:650;font-size:11px}
.wb-terrain-label.is-focused small{color:var(--dsw-alias-label-secondary)}
.wb-terrain-tip{position:absolute;z-index:12;width:216px;transform:translate(-50%,-112%);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-3));box-shadow:0 12px 32px rgba(0,0,0,.28);padding:8px 10px;pointer-events:none;display:flex;flex-direction:column;gap:3px;animation:wb-tip-in .14s var(--wb-ease-out) both}
.wb-terrain-tip.is-below{transform:translate(-50%,12%)}
.wb-terrain-tip.is-tip-left,.wb-terrain-tip.is-tip-right{animation:none}
.wb-terrain-tip.is-tip-left{transform:translate(-100%,-112%)}
.wb-terrain-tip.is-tip-left.is-below{transform:translate(-100%,12%)}
.wb-terrain-tip.is-tip-right{transform:translate(0,-112%)}
.wb-terrain-tip.is-tip-right.is-below{transform:translate(0,12%)}
.wb-terrain-tip b{font-size:11px;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb-terrain-tip span{font-size:9px;color:var(--dsw-alias-label-secondary)}
.wb-terrain-tip small{font-size:9px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.wb-terrain-axis{position:absolute;left:68px;right:0;bottom:0;height:30px;display:flex;align-items:center;gap:10px;color:var(--dsw-alias-label-tertiary);font-size:9px}
.wb-terrain-axis>span:first-child,.wb-terrain-axis>span:last-child{white-space:nowrap}
.wb-terrain-axis-line{display:flex;align-items:center;gap:7px;flex:1;min-width:0;white-space:nowrap}
.wb-terrain-axis-line i{display:block;flex:1;height:1px;background:linear-gradient(90deg,transparent,var(--dsw-alias-border-l2),transparent)}
.wb-terrain-inspector{position:relative;min-width:0;border-left:1px solid var(--dsw-alias-border-l1);padding:4px 0 2px 18px;animation:wb-inspector-in .28s var(--wb-ease-out) both}
.wb-terrain-inspector-top{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.wb-terrain-name{margin:13px 0 7px;font-size:25px;line-height:1.02;letter-spacing:-.045em;font-weight:660;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}
.wb-terrain-path{font-size:9px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;direction:rtl;text-align:left}
.wb-terrain-note{margin:12px 0 13px;color:var(--dsw-alias-label-secondary);font-size:10.5px;line-height:1.55;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.wb-terrain-note.is-empty{color:var(--dsw-alias-label-tertiary)}
.wb-terrain-metrics{display:grid;grid-template-columns:1fr 1fr;gap:0;border-top:1px solid var(--dsw-alias-border-l1);border-bottom:1px solid var(--dsw-alias-border-l1);padding:10px 0}
.wb-terrain-metrics div{display:flex;flex-direction:column;gap:2px;padding:3px 0;min-width:0}
.wb-terrain-metrics b{font-size:11px;font-weight:550;color:var(--dsw-alias-label-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}
.wb-terrain-metrics span{font-size:8px;letter-spacing:.08em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}
.wb-terrain-stages{display:flex;gap:3px;padding:11px 0 0}
.wb-terrain-stage{flex:1;height:3px;border-radius:2px;background:var(--dsw-alias-bg-layer-3);overflow:hidden}
.wb-terrain-stage.is-done{background:var(--dsw-alias-state-success-primary)}
.wb-terrain-stage.is-running{background:var(--dsw-alias-brand-primary)}
.wb-terrain-stage.is-failed{background:var(--dsw-alias-state-error-primary)}
.wb-terrain-actions{display:flex;flex-direction:column;gap:8px;padding-top:14px}
.wb-terrain-actions .wb-btn{justify-content:center}
.wb-terrain-actions>span{font-size:8px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}
.wb-terrain-coord{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:14px;color:var(--dsw-alias-label-tertiary);font-size:9px;font-variant-numeric:tabular-nums}
.wb-terrain-state{display:inline-flex;align-items:center;gap:4px}
.wb-terrain-state i{width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-label-tertiary)}
.wb-terrain-state.is-active i{background:var(--dsw-alias-state-success-primary)}
.wb-terrain-state.is-attention i{background:var(--dsw-alias-state-warn-primary)}
.wb-terrain-state.is-running i{background:var(--dsw-alias-state-success-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-state-success-primary) 15%,transparent)}
@keyframes wb-terrain-node-in{from{opacity:0;transform:translate(-50%,-50%) scale(.15)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
@keyframes wb-inspector-in{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
@keyframes wb-terrain-focus-pulse{0%{opacity:.7;transform:scale(.86)}70%,100%{opacity:0;transform:scale(1.55)}}
@keyframes wb-tip-in{from{opacity:0;transform:translate(-50%,-100%)}to{opacity:1;transform:translate(-50%,-112%)}}
@media (max-width:1180px){.wb-terrain-shell{grid-template-columns:minmax(0,1fr) 250px;gap:12px}.wb-terrain-inspector{padding-left:14px}.wb-terrain-name{font-size:22px}}
@media (max-width:1180px){.wb-terrain-shell{grid-template-columns:1fr}.wb-terrain-plot{min-height:440px}.wb-terrain-inspector{border-left:0;border-top:1px solid var(--dsw-alias-border-l1);padding:14px 0 0}.wb-terrain-label{font-size:9px}.wb-terrain-name{font-size:24px}}
@media (max-width:640px){.wb-terrain{padding:11px 11px 9px}.wb-terrain-head{gap:8px;flex-wrap:wrap}.wb-terrain-kicker{font-size:8px}.wb-terrain-legend{gap:7px;order:4;width:100%}.wb-terrain-count{margin-left:0}.wb-terrain-bands,.wb-terrain-field,.wb-terrain-axis{left:48px}.wb-terrain-plot{min-height:380px}.wb-terrain-band span{font-size:8px;right:calc(100% + 6px)}.wb-terrain-label{font-size:8px}.wb-terrain-label:nth-child(n+6){display:none}.wb-terrain-tip{width:190px}}
@media (prefers-reduced-motion:reduce){.wb-terrain-node,.wb-terrain-inspector,.wb-terrain-tip{animation:none}.wb-terrain-dot,.wb-terrain-node.is-focused .wb-terrain-dot::after{transition:none;animation:none}.wb-terrain-node.is-status-running .wb-terrain-dot i{animation:none}}
.wb-sk{padding:4px 0 24px;animation:wb-sk-in .32s var(--wb-ease-out) both}
.wb-sk-head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin:2px 0 14px}
.wb-sk-title{font-size:clamp(30px,3.4vw,54px);line-height:.98;letter-spacing:-.055em;margin:8px 0 10px;color:var(--dsw-alias-label-primary);font-weight:760}
.wb-sk-sub{max-width:760px;margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.6}
.wb-sk-head-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end}
.wb-sk-note{max-width:260px;color:var(--dsw-alias-label-secondary);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb-sk-switch{display:flex;align-items:center;gap:6px;margin:0 0 14px;flex-wrap:wrap}
.wb-sk-pill{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:7px 11px;font:inherit;font-size:11px;cursor:pointer;transition:background var(--wb-dur-fast) var(--wb-ease),border-color var(--wb-dur-fast) var(--wb-ease),color var(--wb-dur-fast) var(--wb-ease)}
.wb-sk-pill b{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary);font-size:11px}
.wb-sk-pill:hover{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary)}
.wb-sk-pill.on{background:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-base)}
.wb-sk-pill.on b{color:var(--dsw-alias-bg-base)}
.wb-sk-scanned{margin-left:auto;color:var(--dsw-alias-label-tertiary);font-size:10px}
.wb-sk-layout{display:grid;grid-template-columns:minmax(0,1fr) 352px;gap:16px;align-items:start}
.wb-sk-main{min-width:0;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
.wb-sk-matrix-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding:14px 16px 10px}
.wb-sk-eyebrow{display:block;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--dsw-alias-label-secondary);font-weight:650}
.wb-sk-matrix-head small{display:block;margin-top:4px;color:var(--dsw-alias-label-tertiary);font-size:10px}
.wb-sk-legend{display:flex;align-items:center;gap:4px;color:var(--dsw-alias-label-tertiary);font-size:9px}
.wb-sk-legend i{display:block;width:13px;height:7px;border-radius:2px;background:rgba(226,122,89,.22)}
.wb-sk-legend i.mid{background:rgba(226,122,89,.5)}
.wb-sk-legend i.hot{background:rgba(226,122,89,.9)}
.wb-sk-matrix{display:grid;grid-template-columns:minmax(116px,1.35fr) repeat(4,minmax(48px,1fr));gap:2px;padding:0 12px 12px;overflow-x:auto}
.wb-sk-matrix-corner{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary);padding:0 6px 4px}
.wb-sk-matrix-corner.bottom{padding:0}
.wb-sk-matrix-cat{font-size:10px;color:var(--dsw-alias-label-tertiary);padding:0 3px 5px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:default}
.wb-sk-matrix-cat.on{color:var(--dsw-alias-brand-primary)}
.wb-sk-source{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0;border:0;border-radius:4px;background:transparent;color:var(--dsw-alias-label-secondary);padding:4px 6px;font:inherit;font-size:10px;text-align:left;cursor:pointer}
.wb-sk-source span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb-sk-source b{font-size:9px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.wb-sk-source:hover,.wb-sk-source.on{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.wb-sk-cell{height:24px;border:0;border-radius:4px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary);font:inherit;font-size:9px;font-variant-numeric:tabular-nums;cursor:default;transition:transform var(--wb-dur-fast) var(--wb-ease),background var(--wb-dur-fast) var(--wb-ease)}
.wb-sk-cell.has{background:rgba(226,122,89,var(--wb-sk-alpha));color:rgba(255,255,255,.92);cursor:pointer}
.wb-sk-cell.has:hover{transform:scale(1.04);filter:brightness(1.12)}
.wb-sk-cell.on{outline:2px solid var(--dsw-alias-label-primary);outline-offset:1px}
.wb-sk-matrix-sum{text-align:center;color:var(--dsw-alias-label-tertiary);font-size:9px;padding:4px 0 0;border-top:1px solid var(--dsw-alias-border-l1);font-variant-numeric:tabular-nums}
.wb-sk-tools{display:flex;align-items:center;gap:7px;padding:10px 12px;border-top:1px solid var(--dsw-alias-border-l1);border-bottom:1px solid var(--dsw-alias-border-l1);flex-wrap:wrap}
.wb-sk-search{flex:1;min-width:190px}
.wb-sk-tools .wb-select{max-width:132px;font-size:10px;padding:6px 7px}
.wb-sk-list-head{display:flex;align-items:baseline;gap:9px;padding:11px 14px 9px}
.wb-sk-list-head span{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--dsw-alias-label-secondary);font-weight:650}
.wb-sk-list-head b{font-size:10px;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}
.wb-sk-list-hint{font-size:10px;letter-spacing:0!important;text-transform:none!important;color:var(--dsw-alias-label-tertiary)!important;font-weight:400!important;margin-left:auto}
.wb-sk-list{max-height:560px;overflow:auto;overscroll-behavior:contain}
.wb-sk-row{display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:20px;width:100%;border:0;border-top:1px solid var(--dsw-alias-border-l1);background:transparent;color:inherit;text-align:left;padding:10px 14px;font:inherit;cursor:pointer;transition:background var(--wb-dur-fast) var(--wb-ease)}
.wb-sk-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.wb-sk-row.on{background:color-mix(in srgb,var(--dsw-alias-brand-primary) 9%,transparent);box-shadow:inset 3px 0 0 var(--dsw-alias-brand-primary)}
.wb-sk-row-main{min-width:0}
.wb-sk-row-name{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:640;color:var(--dsw-alias-label-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-sk-dup{font-style:normal;font-size:9px;font-weight:500;color:var(--dsw-alias-label-tertiary);border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:1px 5px;flex:none}
.wb-sk-row-desc{display:block;margin-top:3px;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-sk-row-side{display:flex;align-items:center;gap:5px;min-width:0;justify-content:flex-end}
.wb-sk-source-tag,.wb-sk-cat-tag,.wb-sk-origin-tag{display:inline-flex;align-items:center;border:1px solid var(--dsw-alias-border-l1);border-radius:4px;padding:2px 5px;font-size:9px;line-height:1.2;white-space:nowrap;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-2)}
.wb-sk-cat-tag{color:var(--dsw-alias-label-tertiary)}
.wb-sk-origin-tag.author{color:var(--dsw-alias-brand-primary)}
.wb-sk-row-path{display:block;min-width:0;color:var(--dsw-alias-label-tertiary);font:9px/1.2 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;direction:rtl;text-align:left}
.wb-sk-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:54px 20px;color:var(--dsw-alias-label-tertiary);font-size:10px}
.wb-sk-empty b{font-size:12px;color:var(--dsw-alias-label-secondary)}
.wb-sk-detail{position:sticky;top:16px;min-width:0;max-height:calc(100vh - 92px);overflow:auto;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-layer-1);padding:16px}
.wb-sk-detail-top{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.wb-sk-detail-name{margin:12px 0 7px;font-size:24px;line-height:1.04;letter-spacing:-.035em;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}
.wb-sk-detail-desc{margin:0 0 12px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.6}
.wb-sk-detail-actions{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
.wb-sk-detail-actions .wb-btn{font-size:10px;padding:6px 8px}
.wb-sk-meta{display:grid;gap:7px;padding:11px 0;border-top:1px solid var(--dsw-alias-border-l1);border-bottom:1px solid var(--dsw-alias-border-l1)}
.wb-sk-meta div{display:grid;grid-template-columns:62px minmax(0,1fr);gap:8px;align-items:baseline}
.wb-sk-meta span{font-size:9px;color:var(--dsw-alias-label-tertiary)}
.wb-sk-meta b,.wb-sk-meta code{font-size:9px;color:var(--dsw-alias-label-secondary);font-weight:500;overflow-wrap:anywhere}
.wb-sk-meta code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;line-height:1.4}
.wb-sk-tags{display:flex;gap:4px;flex-wrap:wrap;padding-top:10px}
.wb-sk-tags span{border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:2px 6px;font-size:9px;color:var(--dsw-alias-label-tertiary)}
.wb-sk-preview-head{margin:14px 0 6px;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--dsw-alias-label-secondary);font-weight:650}
.wb-sk-preview{max-height:245px;overflow:auto;margin:0;padding:10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font:10px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}
.wb-sk-dups{margin-top:6px}
.wb-sk-dup-row{display:flex;flex-direction:column;gap:2px;width:100%;border:0;border-top:1px solid var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-secondary);text-align:left;padding:7px 0;font:inherit;font-size:9px;cursor:pointer}
.wb-sk-dup-row:hover{color:var(--dsw-alias-label-primary)}
.wb-sk-dup-row code{color:var(--dsw-alias-label-tertiary);font:9px/1.3 ui-monospace,SFMono-Regular,Consolas,monospace;overflow-wrap:anywhere}
.wb-sk-detail-empty{display:flex;flex-direction:column;align-items:center;gap:6px;padding:48px 8px;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:10px}
.wb-sk-detail-empty b{font-size:12px;color:var(--dsw-alias-label-secondary)}
.wb-sk-skeleton{margin-top:18px;padding:30px;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;color:var(--dsw-alias-label-tertiary);font-size:11px}
.wb-sk-error{margin:0 0 12px;padding:9px 12px;border:1px solid var(--dsw-alias-state-error-primary);border-radius:8px;color:var(--dsw-alias-state-error-primary);font-size:11px}
@media (max-width:1180px){.wb-sk-layout{grid-template-columns:minmax(0,1fr) 310px}.wb-sk-row{grid-template-columns:minmax(0,1fr) 210px}}
@media (max-width:960px){.wb-sk-layout{grid-template-columns:1fr}.wb-sk-detail{position:static;max-height:none;order:-1}.wb-sk-row{grid-template-columns:1fr}.wb-sk-row-side{justify-content:flex-start;flex-wrap:wrap}.wb-sk-row-path{width:100%;direction:ltr}}
@keyframes wb-sk-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (max-width:760px){.wb-sk-head{align-items:flex-start;flex-direction:column;gap:8px}.wb-sk-head-actions{justify-content:flex-start}.wb-sk-title{font-size:32px}.wb-sk-scanned{margin-left:0;width:100%}.wb-sk-matrix{padding-left:8px;padding-right:8px}.wb-sk-list-hint{display:none}.wb-sk-row{padding:9px 10px}.wb-sk-detail{padding:12px}.wb-sk-tools .wb-select{max-width:none;flex:1}}
@media (prefers-reduced-motion:reduce){.wb-sk,.wb-sk-pill,.wb-sk-cell,.wb-sk-row{transition:none;animation:none}}
@media (max-width:760px){.wb-header-inner{padding:12px 14px}.wb-subtitle{display:none}.wb-scan-state{display:none}.wb-shell{padding:14px 14px 40px}.wb-meta-grid{grid-template-columns:1fr}.wb-modebar-inner{padding:6px 10px;gap:6px}.wb-modebar-kicker,.wb-modebar-note{display:none}.wb-scene-switch.is-dock{width:100%;justify-content:space-between}.wb-scene-switch.is-dock .wb-scene-button{flex:1 1 0;justify-content:center;padding:7px 4px;font-size:10px;gap:4px}.wb-root.is-scene-mode .wb-shell{padding:8px 10px 12px}}
/* Touch-sized navigation and readable project rows on narrow screens. */
.wb-root{container:wb-workbench / inline-size;inline-size:100%;min-inline-size:0}
@media (max-width:600px){
  .wb-root,.wb-main,.wb-shell,.wb-project-page{min-width:0}
  .wb-header-inner{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:6px;padding:8px 10px}
  .wb-header-spacer{display:none}
  .wb-brand{gap:7px;min-width:0}.wb-brand-mark{width:30px;height:30px;flex:none;border-radius:9px}
  .wb-title{font-size:15px;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .wb-version{font-size:8px;margin-left:4px;padding:0 3px}
  .wb-header-inner>.wb-btn{min-height:40px;padding:6px 8px;font-size:12px;gap:4px}
  .wb-modebar-inner{flex-wrap:nowrap;gap:7px;min-width:0;padding:5px 10px}
  .wb-modebar-inner .wb-scene-switch.is-dock{flex:1 1 0;width:0;min-width:0;justify-content:flex-start;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:thin;-webkit-overflow-scrolling:touch}
  .wb-scene-switch.is-dock .wb-scene-button{flex:0 0 auto;min-width:64px;min-height:42px;padding:6px 8px;font-size:12px}
  .wb-scene-settings{flex:none;margin:0}.wb-scene-settings summary{min-height:42px;display:flex;align-items:center;padding:7px;font-size:12px}
  .wb-scene-settings-panel{max-height:min(65vh,520px);max-height:min(65dvh,520px)}
  .wb-scene-settings-panel select,.wb-scene-settings-row button{min-height:42px}.wb-scene-settings-row button{min-width:42px}
  .wb-tabs{gap:4px;overscroll-behavior-x:contain;scrollbar-width:thin;-webkit-overflow-scrolling:touch}
  .wb-tabs .wb-tab,.wb-root.is-scene-mode .wb-tabs .wb-tab{min-height:44px;flex:none;padding:10px 12px;font-size:13px}
  .wb-shell{padding:12px 10px 36px}.wb-root.is-scene-mode .wb-shell{padding:6px 8px 10px}
  .wb-root .wb-input,.wb-root .wb-select,.wb-scene-settings-panel select{font-size:16px}
  .wb-tools{gap:8px}.wb-tools>.wb-search{flex:1 1 100%;min-width:0;max-width:none}.wb-search .wb-input{width:100%}
  .wb-tools>.wb-select{flex:1 1 calc(50% - 8px);min-width:0;max-width:100%;min-height:44px}
  .wb-tools>.wb-seg{display:flex;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}.wb-seg button{min-height:44px;flex:none}
  .wb-tools.sub .wb-panel-sub{flex-basis:100%;margin:0;text-align:left}.wb-check-group{gap:6px 14px}.wb-check{min-height:40px}
  .wb-grid,.wb-sw-grid{grid-template-columns:minmax(0,1fr)}
  .wb-table-wrap{min-width:0;max-width:100%}.wb-table,.wb-table tbody{display:block;width:100%}
  .wb-table thead{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
  .wb-table tbody tr{position:relative;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 14px;padding:14px;border-bottom:1px solid var(--dsw-alias-border-l1)}
  .wb-table tbody tr:last-child{border-bottom:0}.wb-table td{display:flex;flex-direction:column;align-items:flex-start;gap:4px;min-width:0;padding:0;border:0;text-align:left}
  .wb-table td[data-label]::before{content:attr(data-label);color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}
  .wb-table td.name{grid-column:1/-1;max-width:none;padding-right:32px;white-space:normal;overflow-wrap:anywhere;font-size:15px;line-height:21px}
  .wb-table td.sel{position:absolute;right:14px;top:15px;width:auto;padding:0}.wb-table td.sel .wb-select-check{width:20px;height:20px}
  .wb-table td.path{grid-column:1/-1;display:block;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wb-table td.path::before{display:block}
}
/* The workbench can also occupy a narrow panel within a wide browser window.
   These rules use the panel's actual width instead of the browser viewport. */
@container wb-workbench (max-width:600px){
  .wb-main,.wb-shell,.wb-project-page{min-width:0}
  .wb-header-inner{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:6px;padding:8px 10px}
  .wb-header-spacer,.wb-subtitle,.wb-scan-state,.wb-modebar-kicker,.wb-modebar-note{display:none}
  .wb-brand{gap:7px;min-width:0}.wb-brand-mark{width:30px;height:30px;flex:none;border-radius:9px}
  .wb-title{font-size:15px;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .wb-version{font-size:8px;margin-left:4px;padding:0 3px}
  .wb-header-inner>.wb-btn{min-height:40px;padding:6px 8px;font-size:12px;gap:4px}
  .wb-modebar-inner{flex-wrap:nowrap;gap:7px;min-width:0;padding:5px 10px}
  .wb-modebar-inner .wb-scene-switch.is-dock{flex:1 1 0;width:0;min-width:0;justify-content:flex-start;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:thin;-webkit-overflow-scrolling:touch}
  .wb-scene-switch.is-dock .wb-scene-button{flex:0 0 auto;min-width:64px;min-height:42px;padding:6px 8px;font-size:12px}
  .wb-scene-settings{flex:none;margin:0}.wb-scene-settings summary{min-height:42px;display:flex;align-items:center;padding:7px;font-size:12px}
  .wb-scene-settings-panel{width:min(330px,calc(100cqw - 20px));max-height:min(65vh,520px);max-height:min(65dvh,520px)}
  .wb-scene-settings-panel select,.wb-scene-settings-row button{min-height:42px}.wb-scene-settings-row button{min-width:42px}
  .wb-tabs{gap:4px;overscroll-behavior-x:contain;scrollbar-width:thin;-webkit-overflow-scrolling:touch}
  .wb-tabs .wb-tab,.wb-root.is-scene-mode .wb-tabs .wb-tab{min-height:44px;flex:none;padding:10px 12px;font-size:13px}
  .wb-shell{padding:12px 10px 36px}.wb-root.is-scene-mode .wb-shell{padding:6px 8px 10px}.wb-meta-grid{grid-template-columns:1fr}
  .wb-root .wb-input,.wb-root .wb-select,.wb-scene-settings-panel select{font-size:16px}
  .wb-tools{gap:8px}.wb-tools>.wb-search{flex:1 1 100%;min-width:0;max-width:none}.wb-search .wb-input{width:100%}
  .wb-tools>.wb-select{flex:1 1 calc(50% - 8px);min-width:0;max-width:100%;min-height:44px}
  .wb-tools>.wb-seg{display:flex;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}.wb-seg button{min-height:44px;flex:none}
  .wb-tools.sub .wb-panel-sub{flex-basis:100%;margin:0;text-align:left}.wb-check-group{gap:6px 14px}.wb-check{min-height:40px}
  .wb-grid,.wb-sw-grid{grid-template-columns:minmax(0,1fr)}
  .wb-table-wrap{min-width:0;max-width:100%}.wb-table,.wb-table tbody{display:block;width:100%}
  .wb-table thead{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
  .wb-table tbody tr{position:relative;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 14px;padding:14px;border-bottom:1px solid var(--dsw-alias-border-l1)}
  .wb-table tbody tr:last-child{border-bottom:0}.wb-table td{display:flex;flex-direction:column;align-items:flex-start;gap:4px;min-width:0;padding:0;border:0;text-align:left}
  .wb-table td[data-label]::before{content:attr(data-label);color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}
  .wb-table td.name{grid-column:1/-1;max-width:none;padding-right:32px;white-space:normal;overflow-wrap:anywhere;font-size:15px;line-height:21px}
  .wb-table td.sel{position:absolute;right:14px;top:15px;width:auto;padding:0}.wb-table td.sel .wb-select-check{width:20px;height:20px}
  .wb-table td.path{grid-column:1/-1;display:block;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wb-table td.path::before{display:block}
}
.wb-main::-webkit-scrollbar{width:10px;height:10px}
.wb-main::-webkit-scrollbar-button{display:none;width:0;height:0}
.wb-main::-webkit-scrollbar-thumb{background:var(--dsw-alias-border-l3);border-radius:8px;border:3px solid transparent;background-clip:content-box}
/* Project workspace: an in-main place, never an overlay. */
.wb-ws{min-height:100%;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base)}
.wb-ws-followup{display:flex;align-items:center;gap:12px;padding:10px 28px;background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 8%,var(--dsw-alias-bg-base));border-bottom:1px solid color-mix(in srgb,var(--dsw-alias-state-warn-primary) 24%,var(--dsw-alias-border-l1));color:var(--dsw-alias-state-warn-primary)}
.wb-ws-followup>div{display:flex;align-items:baseline;gap:8px;min-width:0;flex:1}
.wb-ws-followup b{font-size:11px}.wb-ws-followup span{font-size:11px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb-ws-body{width:100%;max-width:1480px;margin:0 auto;padding:20px 28px 44px;flex:1}
.wb-ws-pane{animation:wb-ws-enter .24s var(--wb-ease-out) both}
.wb-ws-compose-input{flex:1;min-height:52px;max-height:160px;resize:vertical;box-sizing:border-box;line-height:1.6}
.wb-ws-overview-grid{display:grid;grid-template-columns:minmax(0,1.68fr) minmax(270px,.72fr);gap:18px;align-items:start}
.wb-ws-overview-main,.wb-ws-side{display:flex;flex-direction:column;gap:16px;min-width:0}
.wb-ws-section,.wb-ws-side-card,.wb-ws-settings-card,.wb-ws-linkbox{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:14px;padding:16px}
.wb-ws-section-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
.wb-ws-section-head h2{display:flex;align-items:center;gap:6px;margin:0;font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-weight:650;color:var(--dsw-alias-label-secondary)}
.wb-ws-section-head>span{font-size:10px;color:var(--dsw-alias-label-tertiary)}
.wb-ws-runtime{display:flex;flex-direction:column;gap:11px}
.wb-ws-runtime-head{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.wb-ws-runtime-stage{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb-ws-progress{flex:1;min-width:80px;height:4px;border-radius:99px;background:var(--dsw-alias-bg-layer-3);overflow:hidden}
.wb-ws-progress i{display:block;height:100%;background:var(--dsw-alias-brand-primary);border-radius:inherit;transition:width .32s var(--wb-ease-out)}
.wb-ws-runtime-facts{display:flex;align-items:center;gap:14px;flex-wrap:wrap;font-size:10px;color:var(--dsw-alias-label-tertiary)}
.wb-ws-runtime-facts b{color:var(--dsw-alias-label-secondary);font-weight:600}
.wb-ws-pipeline{display:flex;align-items:center;gap:4px;flex-wrap:wrap;padding-top:2px}
.wb-ws-pipe{display:inline-flex;align-items:center;gap:4px;font-size:9px;color:var(--dsw-alias-label-dimmed);padding:3px 6px;border:1px solid var(--dsw-alias-border-l1);border-radius:99px}
.wb-ws-pipe i{width:5px;height:5px;border-radius:50%;background:currentColor}
.wb-ws-pipe.is-done{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 25%,var(--dsw-alias-border-l1))}
.wb-ws-pipe.is-running{color:var(--dsw-alias-brand-primary);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 30%,var(--dsw-alias-border-l1))}
.wb-ws-pipe.is-failed{color:var(--dsw-alias-state-error-primary)}
.wb-ws-health{display:flex;flex-direction:column;gap:4px;font-size:10px;color:var(--dsw-alias-state-warn-primary)}
.wb-ws-health span{display:flex;align-items:center;gap:5px}
.wb-ws-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;min-height:180px;padding:24px;text-align:center;border:1px dashed var(--dsw-alias-border-l1);border-radius:14px;color:var(--dsw-alias-label-tertiary)}
.wb-ws-empty.small{min-height:84px;flex-direction:row;justify-content:flex-start;text-align:left;font-size:11px;padding:16px;border-style:solid}
.wb-ws-empty b{font-size:12px;color:var(--dsw-alias-label-secondary)}
.wb-ws-empty span{font-size:10px}
.wb-ws-art-strip{display:grid;grid-template-columns:1.25fr 1fr;grid-template-rows:112px 112px;gap:8px}
.wb-ws-art-strip .wb-ws-art:first-child{grid-row:span 2}
.wb-ws-art{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;overflow:hidden;background:var(--dsw-alias-bg-layer-2);display:flex;flex-direction:column;min-width:0;transition:transform .18s var(--wb-ease-out),border-color .18s}
.wb-ws-art.is-openable{cursor:pointer}
.wb-ws-art.is-openable:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 34%,var(--dsw-alias-border-l1))}
.wb-ws-art-media{position:relative;flex:1;min-height:72px;background:linear-gradient(135deg,var(--dsw-alias-bg-layer-2),var(--dsw-alias-bg-layer-3));display:flex;align-items:center;justify-content:center;overflow:hidden}
.wb-ws-art-media img,.wb-ws-art-media video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.wb-ws-art-placeholder{display:flex;flex-direction:column;align-items:center;gap:6px;color:var(--dsw-alias-label-dimmed);font-size:9px;letter-spacing:.12em;text-transform:uppercase}
.wb-ws-art-body{padding:8px 10px 9px;display:flex;flex-direction:column;gap:3px;min-width:0}
.wb-ws-art-title{font-size:11px;font-weight:600;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-ws-art-meta{display:flex;gap:7px;font-size:9px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden}
.wb-ws-art-preview{margin:2px 0 0;font-size:9px;line-height:1.45;color:var(--dsw-alias-label-tertiary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.wb-ws-art-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
.wb-ws-art-grid .wb-ws-art{min-height:230px}
.wb-ws-pane-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:16px}
.wb-ws-pane-head h2{font-size:20px;letter-spacing:-.03em;margin:0 0 4px;font-weight:650}
.wb-ws-pane-head p{font-size:11px;color:var(--dsw-alias-label-tertiary);margin:0}
.wb-ws-note{min-height:132px;resize:vertical;width:100%;box-sizing:border-box;line-height:1.7}
.wb-ws-note-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:8px;font-size:10px;color:var(--dsw-alias-label-tertiary)}
.wb-note-saved{color:var(--dsw-alias-state-success-primary)}
.wb-ws-session-list{display:flex;flex-direction:column;gap:2px}
.wb-ws-session{display:flex;align-items:center;gap:9px;padding:8px 4px;border-bottom:1px solid var(--dsw-alias-border-l1);min-width:0}
.wb-ws-session:last-child{border-bottom:0}
.wb-ws-session-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-label-dimmed);flex:0 0 auto}
.wb-ws-session-dot[data-running="1"]{background:var(--dsw-alias-state-success-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-state-success-primary) 12%,transparent)}
.wb-ws-session-main{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.wb-ws-session-title{font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-ws-session-meta{display:flex;align-items:center;gap:5px;font-size:9px;color:var(--dsw-alias-label-tertiary)}
.wb-ws-session-actions{display:flex;align-items:center;gap:2px;flex:0 0 auto}
.wb-ws-session-list.is-full .wb-ws-session{padding:11px 4px}
.wb-ws-session-list.is-full .wb-ws-session-title{font-size:12px}
.wb-ws-linkbox{margin-top:16px;display:flex;flex-direction:column;gap:10px}
.wb-ws-side-card{padding:14px}
.wb-ws-side-title{font-size:10px;letter-spacing:.09em;text-transform:uppercase;font-weight:650;color:var(--dsw-alias-label-tertiary);margin-bottom:10px}
.wb-ws-facts{display:flex;flex-direction:column;gap:0}
.wb-ws-facts>div{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px solid var(--dsw-alias-border-l1);min-width:0}
.wb-ws-facts>div:last-child{border-bottom:0}
.wb-ws-facts span{font-size:10px;color:var(--dsw-alias-label-tertiary);flex:0 0 auto}
.wb-ws-facts b{font-size:10px;font-weight:550;color:var(--dsw-alias-label-secondary);text-align:right;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb-ws-relation{display:flex;align-items:center;gap:7px;width:100%;border:0;border-bottom:1px solid var(--dsw-alias-border-l1);background:none;color:var(--dsw-alias-label-secondary);font:inherit;font-size:10px;padding:7px 0;text-align:left;cursor:pointer;min-width:0}
.wb-ws-relation:hover{color:var(--dsw-alias-brand-primary)}
.wb-ws-relation span:nth-child(2){overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.wb-ws-relation small{font-size:9px;color:var(--dsw-alias-label-tertiary)}
.wb-ws-settings{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:start}
.wb-ws-settings .wb-ws-pane-head{grid-column:1/-1}
.wb-ws-settings-card{display:flex;flex-direction:column;gap:10px}
.wb-ws-settings-card .wb-ws-side-title{margin-bottom:0}
.wb-ws-settings-card .wb-meta-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.wb-ws-settings-card .wb-integration-meta{grid-template-columns:repeat(3,minmax(0,1fr))}
.wb-lineage-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:14px;padding:14px 16px;margin-bottom:14px}
.wb-lineage-head p{margin:4px 0 0;font-size:10px;line-height:1.55;color:var(--dsw-alias-label-tertiary);max-width:680px}
.wb-lineage-kicker{display:flex;align-items:center;gap:6px;font-size:10px;font-weight:650;letter-spacing:.08em;text-transform:uppercase;color:var(--dsw-alias-label-secondary)}
.wb-lineage-group{border-left:2px solid var(--dsw-alias-border-l2);padding-left:10px;margin:8px 0 12px}
.wb-lineage-group.is-continuation{border-left-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 60%,var(--dsw-alias-border-l2))}
.wb-lineage-group.is-unassigned{border-left-color:var(--dsw-alias-border-l1)}
.wb-lineage-group.is-side{border-left-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 55%,var(--dsw-alias-border-l2))}
.wb-lineage-label{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:1px 4px 4px;font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}
.wb-lineage-label b{font-size:8px;font-weight:600;color:var(--dsw-alias-label-dimmed)}
.wb-lineage-hint{margin:0 4px 4px;font-size:9px;color:var(--dsw-alias-label-dimmed)}
.wb-chip.is-lineage-main,.wb-chip.is-lineage-persistent{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 35%,var(--dsw-alias-border-l2))}
.wb-chip.is-lineage-main-candidate,.wb-chip.is-lineage-incubating{color:var(--dsw-alias-brand-primary);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 35%,var(--dsw-alias-border-l2))}
.wb-chip.is-lineage-continuation{color:var(--dsw-alias-link)}
.wb-chip.is-lineage-side,.wb-chip.is-lineage-temporary{color:var(--dsw-alias-state-warn-primary)}
.wb-chip.is-lineage-unclassified{color:var(--dsw-alias-label-tertiary)}
.wb-life-settings{gap:8px}
.wb-life-settings-sub{margin:0;font-size:10px;line-height:1.55;color:var(--dsw-alias-label-tertiary)}
.wb-life-choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.wb-life-choice{display:flex;align-items:center;gap:6px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font:inherit;font-size:10px;padding:8px 9px;cursor:pointer;text-align:left;transition:border-color .18s ease,background .18s ease,color .18s ease}
.wb-life-choice i{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-label-dimmed);flex:0 0 auto}
.wb-life-choice span{flex:1}
.wb-life-choice.is-persistent i{background:var(--dsw-alias-state-success-primary)}
.wb-life-choice.is-incubating i{background:var(--dsw-alias-brand-primary)}
.wb-life-choice.is-temporary i{background:var(--dsw-alias-state-warn-primary)}
.wb-life-choice:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2)}
.wb-life-choice.on{color:var(--dsw-alias-label-primary);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 48%,var(--dsw-alias-border-l2));background:color-mix(in srgb,var(--dsw-alias-brand-primary) 8%,var(--dsw-alias-bg-layer-2))}
.wb-field-label{font-size:9px;letter-spacing:.07em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary);margin-top:2px}
.wb-life-settings-foot{display:flex;flex-direction:column;gap:3px;border-top:1px solid var(--dsw-alias-border-l1);padding-top:7px;font-size:9px;line-height:1.45;color:var(--dsw-alias-label-tertiary)}
.wb-life-settings-foot code{font-family:var(--wb-mono,ui-monospace,SFMono-Regular,Consolas,monospace);font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-dimmed)}
.wb-integration-card{grid-column:1/-1}
.wb-integration-sub{margin:0;font-size:10px;line-height:1.6;color:var(--dsw-alias-label-tertiary);max-width:78ch}
.wb-integration-meta{margin-top:10px;grid-template-columns:repeat(3,minmax(0,1fr))}
.wb-integration-note{display:flex;align-items:flex-start;gap:6px;margin:10px 0 0;border-top:1px solid var(--dsw-alias-border-l1);padding-top:8px;font-size:10px;line-height:1.55;color:var(--dsw-alias-state-warn-primary)}
.wb-chip.is-integration-index{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary)}
.wb-chip.is-integration-project{border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 40%,transparent);color:var(--dsw-alias-link)}
.wb-chip.is-integration-app{border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 35%,transparent);color:var(--dsw-alias-state-success-primary)}
.wb-chip.is-integration-unknown{border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 35%,transparent);color:var(--dsw-alias-state-warn-primary)}
.wb-ws-footer{display:flex;align-items:center;gap:16px;padding:14px 28px 18px;border-top:1px solid var(--dsw-alias-border-l1);background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 52%,transparent);margin-top:auto}
.wb-ws-footer-info{display:flex;align-items:center;gap:6px;min-width:0;font-size:10px;color:var(--dsw-alias-label-tertiary)}
.wb-ws-footer-info span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb-ws-footer-actions{display:flex;align-items:center;gap:6px;margin-left:auto;flex:0 0 auto}
@keyframes wb-ws-enter{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
::view-transition-group(wb-project-morph){animation-duration:.44s;animation-timing-function:cubic-bezier(.2,0,0,1)}
::view-transition-old(wb-project-morph){animation-duration:.34s;animation-timing-function:cubic-bezier(.2,0,0,1)}
::view-transition-new(wb-project-morph){animation-duration:.44s;animation-timing-function:cubic-bezier(.2,0,0,1)}
::view-transition-group(root){animation:none}
::view-transition-old(root){animation:none;opacity:0}
::view-transition-new(root){animation:wb-vt-root-in .24s var(--wb-ease-out) both;mix-blend-mode:normal}
@keyframes wb-vt-root-in{from{opacity:0}to{opacity:1}}
@media (max-width:1080px){.wb-ws-overview-grid{grid-template-columns:1fr}.wb-ws-side{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}.wb-ws-settings{grid-template-columns:1fr}}
@media (max-width:760px){.wb-ws-body{padding:14px 14px 32px}.wb-ws-side{grid-template-columns:1fr}.wb-ws-art-strip{grid-template-columns:1fr 1fr;grid-template-rows:140px 100px}.wb-ws-art-strip .wb-ws-art:first-child{grid-row:auto;grid-column:span 2}.wb-ws-footer{flex-wrap:wrap;padding:12px 14px}.wb-ws-footer-info{width:100%}.wb-ws-footer-actions{margin-left:0}.wb-ws-settings .wb-meta-grid{grid-template-columns:1fr}.wb-ws-followup{align-items:flex-start;flex-wrap:wrap;padding:10px 14px}.wb-ws-followup>div{flex-direction:column;gap:2px;flex-basis:100%}}
@media (prefers-reduced-motion:reduce){.wb-ws-pane{animation:none}.wb-ws-art{transition:none}}

/* Project wall: names first, imagery second. No hover required to know what a project is. */
.wb-link{appearance:none;border:0;background:none;color:var(--dsw-alias-link);font:inherit;font-size:10px;display:inline-flex;align-items:center;gap:4px;padding:2px 0;cursor:pointer;white-space:nowrap}
.wb-link:hover{color:var(--dsw-alias-brand-primary)}
.wb-wall-page{display:flex;flex-direction:column;gap:20px;padding:4px 0 36px;min-width:0}
.wb-wall-hero{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"kicker actions" "headline facts";gap:10px 24px;align-items:end;padding:14px 2px 4px}
.wb-wall-kicker{grid-area:kicker;display:flex;align-items:center;gap:8px;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}
.wb-wall-kicker span{margin-left:auto;letter-spacing:.04em;text-transform:none}
.wb-wall-live-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-success-primary);box-shadow:0 0 0 4px color-mix(in srgb,var(--dsw-alias-state-success-primary) 11%,transparent)}
.wb-wall-headline{grid-area:headline;min-width:0}
.wb-wall-title{margin:0;font-size:clamp(32px,4.4vw,58px);line-height:1.02;font-weight:620;letter-spacing:-.05em}
.wb-wall-title em{font-style:normal;color:var(--dsw-alias-brand-primary)}
.wb-wall-sub{margin:9px 0 0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.55;max-width:640px}
.wb-wall-actions{grid-area:actions;display:flex;align-items:center;gap:8px;justify-content:flex-end;flex-wrap:wrap}
.wb-wall-actions b{font-size:10px;border-radius:999px;padding:1px 5px;background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 14%,transparent);color:var(--dsw-alias-state-warn-primary)}
.wb-wall-facts{grid-area:facts;display:flex;gap:20px;justify-content:flex-end;align-items:flex-end}
.wb-wall-facts div{display:flex;flex-direction:column;gap:1px;align-items:flex-end}
.wb-wall-facts b{font-size:22px;line-height:1;font-weight:560;letter-spacing:-.03em}
.wb-wall-facts span{font-size:9px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.wb-life-chip{flex:0 0 auto;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:1px 5px;font-size:8px;line-height:14px;font-weight:600;letter-spacing:.02em;color:var(--dsw-alias-label-secondary);background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 72%,transparent);white-space:nowrap}
.wb-life-chip.is-persistent{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 36%,var(--dsw-alias-border-l2))}
.wb-life-chip.is-incubating{color:var(--dsw-alias-brand-primary);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 38%,var(--dsw-alias-border-l2))}
.wb-life-chip.is-temporary{color:var(--dsw-alias-state-warn-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 34%,var(--dsw-alias-border-l2))}
.wb-life-chip.is-unclassified{color:var(--dsw-alias-label-tertiary)}
.wb-wall-card.is-feature .wb-life-chip{color:color-mix(in srgb,#fff 78%,transparent);border-color:color-mix(in srgb,#fff 25%,transparent);background:color-mix(in srgb,#000 25%,transparent)}
.wb-lifecycle-switch{display:flex;align-items:center;gap:5px;min-width:0;flex-wrap:wrap;border-top:1px solid var(--dsw-alias-border-l1);border-bottom:1px solid var(--dsw-alias-border-l1);padding:8px 0}
.wb-lifecycle-tab{appearance:none;border:1px solid transparent;border-radius:999px;background:none;color:var(--dsw-alias-label-secondary);font:inherit;font-size:10px;display:inline-flex;align-items:center;gap:6px;padding:5px 9px;cursor:pointer;transition:background .18s ease,border-color .18s ease,color .18s ease}
.wb-lifecycle-tab b{font-size:9px;font-weight:650;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.wb-lifecycle-tab:hover{color:var(--dsw-alias-label-primary);background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 72%,transparent)}
.wb-lifecycle-tab.is-active{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2);background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 82%,transparent)}
.wb-lifecycle-tab.is-active b{color:var(--dsw-alias-brand-primary)}
.wb-lifecycle-rule{margin-left:auto;font-size:9px;color:var(--dsw-alias-label-dimmed);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-life-shelf{border-top:1px solid var(--dsw-alias-border-l1);padding-top:13px;display:flex;flex-direction:column;gap:7px}
.wb-life-shelf-head{display:flex;align-items:flex-end;justify-content:space-between;gap:14px}
.wb-life-shelf-head h2{display:flex;align-items:center;gap:6px;margin:0;font-size:11px;font-weight:600;letter-spacing:.01em;color:var(--dsw-alias-label-secondary)}
.wb-life-shelf-head p{margin:3px 0 0;font-size:10px;color:var(--dsw-alias-label-tertiary)}
.wb-life-shelf-list{display:flex;flex-direction:column}
.wb-life-shelf-row{display:flex;align-items:center;gap:9px;width:100%;min-width:0;border:0;border-bottom:1px solid var(--dsw-alias-border-l1);background:none;color:var(--dsw-alias-label-secondary);font:inherit;text-align:left;padding:8px 0;cursor:pointer}
.wb-life-shelf-row:hover{color:var(--dsw-alias-label-primary)}
.wb-life-shelf-mark{display:grid;place-items:center;width:22px;height:22px;border-radius:7px;flex:0 0 auto;background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 82%,transparent);color:var(--dsw-alias-label-tertiary)}
.wb-life-shelf.is-temporary .wb-life-shelf-mark{color:var(--dsw-alias-state-warn-primary)}
.wb-life-shelf.is-inbox .wb-life-shelf-mark{color:var(--dsw-alias-label-tertiary)}
.wb-life-shelf-main{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}
.wb-life-shelf-main b{font-size:11px;font-weight:550;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb-life-shelf-main small{font-size:9px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb-life-shelf-time{font-size:9px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;flex:0 0 auto;max-width:220px;overflow:hidden;text-overflow:ellipsis}
.wb-life-shelf-time.is-due{color:var(--dsw-alias-state-warn-primary)}
.wb-wall-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:minmax(236px,auto);gap:12px}
.wb-wall-bands{display:flex;flex-direction:column;gap:26px}
.wb-wall-band{display:flex;flex-direction:column;gap:10px}
.wb-wall-band-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;padding:0 2px}
.wb-wall-band-head h2{margin:0;font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--dsw-alias-label-secondary)}
.wb-wall-band-head p{margin:3px 0 0;font-size:10px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}
.wb-wall-band-head b{font-family:var(--wb-mono,ui-monospace,SFMono-Regular,Consolas,monospace);font-size:10px;font-weight:500;color:var(--dsw-alias-label-tertiary)}
.wb-wall-card{animation:wb-wall-in .36s var(--wb-ease-out) both;animation-delay:calc(var(--wb-wall-i) * 26ms);position:relative;display:flex;flex-direction:column;min-width:0;overflow:hidden;border:1px solid var(--dsw-alias-border-l1);border-radius:16px;background:var(--dsw-alias-bg-layer-1);cursor:pointer;isolation:isolate;transition:transform .24s var(--wb-ease-out),border-color .24s var(--wb-ease-out),box-shadow .24s var(--wb-ease-out)}
@keyframes wb-wall-in{from{opacity:0;translate:0 10px}to{opacity:1;translate:0 0}}
.wb-wall-card:hover,.wb-wall-card:focus-visible{transform:translateY(-3px);border-color:color-mix(in srgb,var(--wb-accent) 55%,var(--dsw-alias-border-l2));box-shadow:0 18px 48px color-mix(in srgb,#000 26%,transparent)}
.wb-wall-card:focus-visible,.wb-wall-rest-row:focus-visible,.wb-room-chapter:focus-visible{outline:2px solid var(--wb-accent,var(--wb-room-accent,var(--dsw-alias-brand-primary)));outline-offset:2px}
.wb-wall-card.is-feature{grid-column:span 2;grid-row:span 2;min-height:484px;justify-content:flex-end}
.wb-wall-card.is-wide{grid-column:1/-1;display:grid;grid-template-columns:minmax(260px,.8fr) minmax(0,1.2fr);min-height:250px}
.wb-wall-card.is-wide .wb-wall-visual{height:auto;min-height:250px}
.wb-wall-card.is-wide .wb-wall-copy{justify-content:center;padding:24px 30px}
.wb-wall-card.is-wide .wb-wall-name{font-size:24px}
.wb-wall-card.is-wide .wb-wall-note{-webkit-line-clamp:2}
.wb-wall-visual{position:relative;height:146px;flex:0 0 auto;overflow:hidden;background:color-mix(in srgb,var(--wb-accent) 9%,var(--dsw-alias-bg-layer-2))}
.wb-wall-card.is-feature .wb-wall-visual{position:absolute;inset:0;height:auto}
.wb-wall-cover{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;transition:transform .45s var(--wb-ease-out);opacity:.92}
.wb-wall-card:hover .wb-wall-cover{transform:scale(1.025)}
.wb-wall-sigil{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;background:
  radial-gradient(120% 130% at 12% 0%,color-mix(in srgb,var(--wb-accent) 26%,transparent),transparent 62%),
  linear-gradient(135deg,color-mix(in srgb,var(--wb-accent) 9%,var(--dsw-alias-bg-layer-2)),var(--dsw-alias-bg-layer-1))}
.wb-wall-sigil:after{content:"";position:absolute;inset:0;background-image:linear-gradient(color-mix(in srgb,var(--dsw-alias-border-l2) 55%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--dsw-alias-border-l2) 55%,transparent) 1px,transparent 1px);background-size:26px 26px;opacity:.18;mask-image:linear-gradient(135deg,#000,transparent 72%)}
.wb-wall-mark{font-size:44px;line-height:1;font-weight:520;letter-spacing:-.08em;color:color-mix(in srgb,var(--wb-accent) 65%,var(--dsw-alias-label-primary));position:relative;z-index:1}
.wb-wall-sigil small{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary);position:relative;z-index:1}
.wb-wall-shade{position:absolute;inset:0;pointer-events:none;background:linear-gradient(180deg,color-mix(in srgb,#000 12%,transparent),transparent 32%,color-mix(in srgb,#000 54%,transparent))}
.wb-wall-card:not(.is-feature) .wb-wall-shade{background:linear-gradient(180deg,transparent 45%,color-mix(in srgb,#000 20%,transparent))}
.wb-wall-topline{position:absolute;top:10px;left:10px;right:10px;display:flex;align-items:center;gap:6px;z-index:2}
.wb-wall-state{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:3px 7px;font-size:10px;font-weight:600;line-height:14px;background:color-mix(in srgb,#000 32%,var(--dsw-alias-bg-layer-2));border:1px solid color-mix(in srgb,#fff 14%,transparent);backdrop-filter:blur(8px);color:var(--dsw-alias-label-primary)}
.wb-wall-state i{width:5px;height:5px;border-radius:50%;background:currentColor}
.wb-wall-state.is-running{color:var(--dsw-alias-brand-primary)}
.wb-wall-state.is-waiting{color:var(--dsw-alias-state-warn-primary)}
.wb-wall-state.is-failed{color:var(--dsw-alias-state-error-primary)}
.wb-wall-state.is-active{color:var(--dsw-alias-state-success-primary)}
.wb-wall-state.is-attention{color:var(--dsw-alias-state-warn-primary)}
.wb-wall-state.is-idle{color:var(--dsw-alias-label-secondary)}
.wb-wall-flag{margin-left:auto;border-radius:999px;padding:3px 7px;font-size:9px;font-weight:600;background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 18%,#000);color:var(--dsw-alias-state-warn-primary);border:1px solid color-mix(in srgb,var(--dsw-alias-state-warn-primary) 35%,transparent)}
.wb-wall-arrow{position:absolute;right:10px;bottom:10px;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:color-mix(in srgb,#000 36%,transparent);border:1px solid color-mix(in srgb,#fff 16%,transparent);color:#fff;transform:rotate(-45deg);z-index:3;transition:transform .24s var(--wb-ease-out),background .24s var(--wb-ease-out)}
.wb-wall-card:hover .wb-wall-arrow{transform:rotate(0);background:var(--wb-accent)}
.wb-wall-index{position:absolute;left:14px;bottom:13px;font-size:10px;letter-spacing:.16em;color:color-mix(in srgb,#fff 55%,transparent);z-index:2}
.wb-wall-copy{position:relative;z-index:2;display:flex;flex-direction:column;gap:5px;min-width:0;padding:12px 13px 14px;flex:1}
.wb-wall-card.is-feature .wb-wall-copy{padding:18px 20px 20px;background:linear-gradient(180deg,transparent,color-mix(in srgb,#000 62%,transparent));gap:7px;flex:0 0 auto;margin-top:auto}
.wb-wall-name-row{display:flex;align-items:baseline;gap:8px;min-width:0}
.wb-wall-name{margin:0;font-size:15px;line-height:1.25;font-weight:600;letter-spacing:-.015em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.wb-wall-card.is-feature .wb-wall-name{font-size:clamp(24px,2.5vw,38px);line-height:1.08;letter-spacing:-.04em;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;color:#fff}
.wb-wall-size{margin-left:auto;font-size:9px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.wb-wall-card.is-feature .wb-wall-size{color:color-mix(in srgb,#fff 62%,transparent)}
.wb-wall-path{font-size:10px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.wb-wall-card.is-feature .wb-wall-path{color:color-mix(in srgb,#fff 52%,transparent)}
.wb-wall-note{margin:0;font-size:10px;line-height:1.5;color:var(--dsw-alias-label-secondary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.wb-wall-stage{display:flex;align-items:center;gap:6px;font-size:10px;color:color-mix(in srgb,#fff 74%,transparent)}
.wb-wall-stage i{width:5px;height:5px;border-radius:50%;background:var(--wb-accent)}
.wb-wall-stage b{font-weight:600;font-variant-numeric:tabular-nums;color:#fff}
.wb-wall-card.is-feature .wb-wall-note{font-size:12px;line-height:1.5;color:color-mix(in srgb,#fff 72%,transparent);-webkit-line-clamp:3;max-width:620px}
.wb-wall-meta{display:flex;align-items:center;gap:9px;margin-top:auto;padding:6px 32px 0 0;font-size:9px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.wb-wall-card.is-feature .wb-wall-meta{color:color-mix(in srgb,#fff 55%,transparent)}
.wb-wall-branch{display:inline-flex;align-items:center;gap:3px;overflow:hidden;text-overflow:ellipsis;max-width:110px}
.wb-wall-memory{display:inline-flex;align-items:center;gap:3px;min-width:0;max-width:78px;overflow:hidden;text-overflow:ellipsis;color:var(--dsw-alias-state-success-primary);font-weight:550}
.wb-wall-time{margin-left:auto;flex:0 0 auto}
.wb-wall-rest{border-top:1px solid var(--dsw-alias-border-l1);padding-top:12px}
.wb-wall-rest-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}
.wb-wall-rest-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 22px}
.wb-wall-rest-row{display:flex;align-items:center;gap:9px;width:100%;border:0;border-bottom:1px solid var(--dsw-alias-border-l1);background:none;color:var(--dsw-alias-label-secondary);font:inherit;text-align:left;padding:9px 0;cursor:pointer;min-width:0}
.wb-wall-rest-row:hover{color:var(--dsw-alias-label-primary)}
.wb-wall-rest-no{font-size:9px;color:var(--dsw-alias-label-dimmed);letter-spacing:.08em;flex:0 0 18px}
.wb-wall-rest-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-label-tertiary);flex:0 0 auto}
.wb-wall-rest-dot.is-running,.wb-wall-rest-dot.is-waiting{background:var(--dsw-alias-brand-primary)}
.wb-wall-rest-dot.is-failed,.wb-wall-rest-dot.is-blocked{background:var(--dsw-alias-state-error-primary)}
.wb-wall-rest-dot.is-active{background:var(--dsw-alias-state-success-primary)}
.wb-wall-rest-main{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}
.wb-wall-rest-main b{font-size:12px;font-weight:550;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb-wall-rest-main small{font-size:9px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb-wall-rest-time{font-size:9px;color:var(--dsw-alias-label-tertiary);flex:0 0 auto}
.wb-wall-all{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;border:1px dashed var(--dsw-alias-border-l2);border-radius:12px;background:none;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;padding:11px;cursor:pointer}
.wb-wall-all:hover{color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}
.wb-wall-empty{display:flex;flex-direction:column;align-items:center;gap:7px;padding:64px 20px;border:1px dashed var(--dsw-alias-border-l2);border-radius:16px;color:var(--dsw-alias-label-tertiary)}
.wb-wall-empty b{font-size:13px;color:var(--dsw-alias-label-secondary)}
.wb-wall-empty span{font-size:11px}
/* Project deck: a stage and a queue, not a pile of cards. */
.wb-deck{display:flex;flex-direction:column;gap:14px;animation:wb-deck-in .38s var(--wb-ease-out) both}
.wb-deck-ribbon{display:grid;grid-template-columns:minmax(178px,.3fr) minmax(0,1fr);gap:18px;align-items:end;padding:11px 13px 9px;border:1px solid var(--dsw-alias-border-l1);border-radius:13px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 76%,transparent)}
.wb-deck-ribbon-copy{display:flex;flex-direction:column;gap:2px;min-width:0}
.wb-deck-eyebrow{display:flex;align-items:center;gap:7px;font-size:9px;line-height:14px;letter-spacing:.14em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}
.wb-deck-live{width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-state-success-primary);box-shadow:0 0 9px color-mix(in srgb,var(--dsw-alias-state-success-primary) 55%,transparent);flex:0 0 auto}
.wb-deck-ribbon-copy b{font-family:var(--wb-mono,ui-monospace,SFMono-Regular,Consolas,monospace);font-size:22px;line-height:26px;font-weight:500;letter-spacing:-.04em}
.wb-deck-ribbon-copy small{font-size:8px;line-height:12px;color:var(--dsw-alias-label-dimmed);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-deck-ribbon-plot{min-width:0}
.wb-deck-bars{display:flex;align-items:flex-end;gap:3px;height:42px;padding-bottom:1px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.wb-deck-bar{flex:1 1 0;min-width:3px;max-width:18px;height:var(--wb-bar-h);padding:0;border:0;border-radius:2px 2px 0 0;background:color-mix(in srgb,var(--wb-accent) 38%,var(--dsw-alias-bg-layer-3));cursor:pointer;transform-origin:bottom;animation:wb-deck-bar .48s var(--wb-ease-out) both;animation-delay:calc(var(--wb-bar-i) * 4ms);transition:background .18s var(--wb-ease-out),filter .18s var(--wb-ease-out),opacity .18s}
.wb-deck-bar:hover{background:color-mix(in srgb,var(--wb-accent) 75%,#fff);filter:brightness(1.08)}
.wb-deck-bar.is-active{background:var(--wb-accent);box-shadow:0 0 12px color-mix(in srgb,var(--wb-accent) 42%,transparent)}
.wb-deck-bar.is-temporary{opacity:.56}
.wb-deck-bar.is-unclassified{opacity:.36}
.wb-deck-axis{display:flex;justify-content:space-between;margin-top:4px;font-family:var(--wb-mono,ui-monospace,SFMono-Regular,Consolas,monospace);font-size:8px;line-height:11px;color:var(--dsw-alias-label-dimmed)}
.wb-deck-grid{display:grid;grid-template-columns:minmax(0,1.52fr) minmax(340px,.78fr);gap:14px;align-items:stretch}
.wb-deck-stage{position:relative;display:grid;grid-template-columns:minmax(220px,.76fr) minmax(0,1.24fr);min-height:528px;border:1px solid var(--dsw-alias-border-l2);border-radius:18px;overflow:hidden;background:var(--dsw-alias-bg-layer-1);isolation:isolate;animation:wb-deck-stage-in .46s var(--wb-ease-out) both}
.wb-deck-stage::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background:radial-gradient(80% 90% at 4% 0%,color-mix(in srgb,var(--wb-accent) 18%,transparent),transparent 64%)}
.wb-deck-stage-visual{position:relative;min-height:100%;overflow:hidden;background:linear-gradient(155deg,color-mix(in srgb,var(--wb-accent) 34%,#0b0d12),color-mix(in srgb,var(--wb-accent) 8%,#0b0d12) 54%,#080a0e)}
.wb-deck-stage-visual::before{content:"";position:absolute;z-index:1;inset:0;background-image:linear-gradient(rgba(255,255,255,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.055) 1px,transparent 1px);background-size:32px 32px;mask-image:radial-gradient(70% 75% at 50% 46%,#000 12%,transparent 78%);opacity:.72;pointer-events:none}
.wb-deck-stage-visual::after{content:"";position:absolute;z-index:1;left:50%;top:46%;width:168px;height:168px;border:1px solid color-mix(in srgb,#fff 17%,transparent);border-radius:50%;transform:translate(-50%,-50%);box-shadow:0 0 0 28px color-mix(in srgb,#fff 6%,transparent),0 0 0 58px color-mix(in srgb,#fff 3%,transparent);pointer-events:none}
.wb-deck-stage-cover{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.44;filter:saturate(.8) contrast(1.04);animation:wb-deck-cover .72s var(--wb-ease-out) both}
.wb-deck-stage-atmos{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.08),rgba(0,0,0,.74)),radial-gradient(70% 45% at 50% 105%,color-mix(in srgb,var(--wb-accent) 28%,transparent),transparent 70%)}
.wb-deck-stage-sigil{position:absolute;z-index:2;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;color:#fff;text-shadow:0 2px 30px rgba(0,0,0,.45);pointer-events:none}
.wb-deck-stage-sigil b{font-size:clamp(48px,5.7vw,82px);line-height:.9;font-weight:550;letter-spacing:-.09em;opacity:.9}
.wb-deck-stage-sigil small{font-size:8px;letter-spacing:.16em;text-transform:uppercase;color:color-mix(in srgb,#fff 54%,transparent);max-width:80%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb-deck-stage-top{position:absolute;z-index:2;left:13px;right:13px;top:13px;display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.wb-deck-pill{display:inline-flex;align-items:center;gap:5px;padding:4px 7px;border:1px solid color-mix(in srgb,#fff 18%,transparent);border-radius:999px;background:rgba(8,10,14,.48);backdrop-filter:blur(8px);color:color-mix(in srgb,#fff 86%,transparent);font-size:9px;line-height:12px;font-weight:600;white-space:nowrap}
.wb-deck-pill i{width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-state-success-primary)}
.wb-deck-pill.is-running i{animation:wb-pulse 1.6s ease-in-out infinite}
.wb-deck-pill.is-waiting i{background:var(--dsw-alias-state-warn-primary)}
.wb-deck-pill.is-failed i{background:var(--dsw-alias-state-error-primary)}
.wb-deck-pill.is-attention{color:#fff;border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 48%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 24%,rgba(8,10,14,.48))}
.wb-deck-stage-index{position:absolute;z-index:2;left:14px;bottom:13px;font-family:var(--wb-mono,ui-monospace,SFMono-Regular,Consolas,monospace);font-size:9px;letter-spacing:.08em;color:color-mix(in srgb,#fff 62%,transparent)}
.wb-deck-stage-scan{position:absolute;z-index:3;inset:0;pointer-events:none;background:linear-gradient(105deg,transparent 32%,rgba(255,255,255,.14) 48%,rgba(255,255,255,.02) 58%,transparent 72%);transform:translateX(-120%);animation:wb-deck-scan .46s .06s var(--wb-ease-out) both}
.wb-deck-stage-copy{position:relative;z-index:1;display:flex;flex-direction:column;gap:11px;min-width:0;padding:25px 27px 22px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--dsw-alias-bg-layer-1) 90%,transparent) 18%,color-mix(in srgb,var(--wb-accent) 4%,var(--dsw-alias-bg-layer-1)) 42%)}
.wb-deck-stage-eyebrow{display:flex;align-items:center;gap:8px;font-size:9px;line-height:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}
.wb-deck-stage-eyebrow i{width:18px;height:1px;background:var(--wb-accent);display:inline-block;opacity:.75}
.wb-deck-stage-name{margin:0;font-size:clamp(30px,3.3vw,48px);line-height:1.03;letter-spacing:-.055em;font-weight:620;overflow-wrap:anywhere;max-width:12ch}
.wb-deck-stage-path{font-family:var(--wb-mono,ui-monospace,SFMono-Regular,Consolas,monospace);font-size:9px;line-height:14px;color:var(--dsw-alias-label-dimmed);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-deck-stage-note{margin:2px 0 0;font-size:12px;line-height:1.65;color:var(--dsw-alias-label-secondary);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;max-width:56ch}
.wb-deck-stage-note.is-empty{color:var(--dsw-alias-label-dimmed);font-style:italic}
.wb-deck-readout{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:auto;padding:12px 0 11px;border-top:1px solid var(--dsw-alias-border-l1)}
.wb-deck-readout>div{display:flex;flex-direction:column;gap:3px;min-width:0}
.wb-deck-readout span{font-size:8px;line-height:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}
.wb-deck-readout b{font-size:10px;line-height:14px;font-weight:500;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-deck-stage-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;padding-top:12px;border-top:1px solid var(--dsw-alias-border-l1)}
.wb-deck-stage-metrics>div{display:flex;flex-direction:column;gap:2px;min-width:0;padding-right:8px;border-right:1px solid var(--dsw-alias-border-l1)}
.wb-deck-stage-metrics>div:last-child{border-right:0;padding-right:0}
.wb-deck-stage-metrics b{font-family:var(--wb-mono,ui-monospace,SFMono-Regular,Consolas,monospace);font-size:13px;line-height:17px;font-weight:500;color:var(--dsw-alias-label-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-deck-stage-metrics span{font-size:8px;line-height:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}
.wb-deck-branch{max-width:100%;display:block;overflow:hidden;text-overflow:ellipsis}
.wb-deck-pipeline{display:flex;gap:4px;align-items:center;padding:2px 0 1px}
.wb-deck-pipe{height:3px;flex:1;border-radius:2px;background:var(--dsw-alias-border-l2);overflow:hidden}
.wb-deck-pipe i{display:block;height:100%;width:100%;background:var(--dsw-alias-label-dimmed);transform-origin:left;transform:scaleX(.18);transition:transform .35s var(--wb-ease-out)}
.wb-deck-pipe.is-done i{background:var(--dsw-alias-state-success-primary);transform:scaleX(1)}
.wb-deck-pipe.is-running i{background:var(--dsw-alias-brand-primary);transform:scaleX(.66)}
.wb-deck-pipe.is-failed i{background:var(--dsw-alias-state-error-primary);transform:scaleX(1)}
.wb-deck-stage-actions{display:flex;align-items:center;gap:11px;flex-wrap:wrap;padding-top:4px}
.wb-deck-stage-hint{font-size:9px;line-height:13px;color:var(--dsw-alias-label-dimmed);max-width:24ch}
.wb-deck-stage-rule{position:absolute;z-index:4;left:0;bottom:0;width:100%;height:2px;background:linear-gradient(90deg,var(--wb-accent),transparent 72%);opacity:.9}
.wb-deck-queue{display:flex;flex-direction:column;min-height:0;max-height:528px;border:1px solid var(--dsw-alias-border-l1);border-radius:18px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 82%,transparent);overflow:hidden}
.wb-deck-queue-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px 14px 10px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.wb-deck-queue-head>div{display:flex;flex-direction:column;gap:3px;min-width:0}
.wb-deck-queue-head b{font-size:11px;line-height:15px;font-weight:650;letter-spacing:.01em}
.wb-deck-queue-head span{font-size:8px;line-height:12px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb-deck-queue-head strong{font-family:var(--wb-mono,ui-monospace,SFMono-Regular,Consolas,monospace);font-size:22px;line-height:24px;font-weight:500;color:var(--dsw-alias-label-secondary);letter-spacing:-.05em}
.wb-deck-queue-scroll{min-height:0;overflow:auto;padding:5px 7px 8px;scrollbar-width:thin;scrollbar-color:var(--dsw-alias-border-l2) transparent}
.wb-deck-group{display:flex;flex-direction:column;gap:1px}
.wb-deck-group+.wb-deck-group{margin-top:6px}
.wb-deck-group-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:8px 6px 5px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 92%,transparent);backdrop-filter:blur(8px);font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}
.wb-deck-group-head b{font-family:var(--wb-mono,ui-monospace,SFMono-Regular,Consolas,monospace);font-weight:500;letter-spacing:0;color:var(--dsw-alias-label-dimmed)}
.wb-deck-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;align-items:center;gap:8px;min-width:0;padding:7px 5px 7px 7px;border:1px solid transparent;border-radius:8px;cursor:pointer;animation:wb-deck-row-in .3s var(--wb-ease-out) both;animation-delay:calc(var(--wb-row-i) * 7ms);transition:background .16s var(--wb-ease-out),border-color .16s var(--wb-ease-out),transform .16s var(--wb-ease-out)}
.wb-deck-row:hover{background:color-mix(in srgb,var(--wb-accent) 6%,var(--dsw-alias-interactive-bg-hover))}
.wb-deck-row.is-selected{background:color-mix(in srgb,var(--wb-accent) 11%,var(--dsw-alias-bg-layer-2));border-color:color-mix(in srgb,var(--wb-accent) 30%,var(--dsw-alias-border-l1));box-shadow:inset 2px 0 0 var(--wb-accent)}
.wb-deck-row:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.wb-deck-row-dot{position:relative;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-label-tertiary);flex:0 0 auto}
.wb-deck-row-dot.is-active,.wb-deck-row-dot.is-running{background:var(--dsw-alias-state-success-primary)}
.wb-deck-row-dot.is-waiting,.wb-deck-row-dot.is-attention{background:var(--dsw-alias-state-warn-primary)}
.wb-deck-row-dot.is-failed{background:var(--dsw-alias-state-error-primary)}
.wb-deck-row-dot i{position:absolute;inset:-3px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-success-primary) 55%,transparent);border-radius:50%;animation:wb-deck-ring 1.8s var(--wb-ease-out) infinite}
.wb-deck-row-main{display:flex;flex-direction:column;gap:1px;min-width:0}
.wb-deck-row-main b{font-size:11px;line-height:15px;font-weight:560;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dsw-alias-label-primary)}
.wb-deck-row-main small{font-size:8px;line-height:12px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-deck-row-side{display:flex;flex-direction:column;align-items:flex-end;gap:2px;min-width:0}
.wb-deck-row-side .wb-life-chip{font-size:7px;line-height:10px;padding:1px 4px;max-width:66px;overflow:hidden;text-overflow:ellipsis}
.wb-deck-row-side small{font-family:var(--wb-mono,ui-monospace,SFMono-Regular,Consolas,monospace);font-size:8px;color:var(--dsw-alias-label-dimmed);white-space:nowrap}
.wb-deck-row-arrow{display:grid;place-items:center;width:16px;color:var(--dsw-alias-label-dimmed);opacity:.45;transition:opacity .16s,transform .16s var(--wb-ease-out)}
.wb-deck-row:hover .wb-deck-row-arrow,.wb-deck-row.is-selected .wb-deck-row-arrow{opacity:1;color:var(--wb-accent);transform:translateX(2px)}
@keyframes wb-deck-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes wb-deck-bar{from{opacity:.15;transform:scaleY(.05)}to{opacity:1;transform:scaleY(1)}}
@keyframes wb-deck-stage-in{from{opacity:.25;transform:translateY(7px) scale(.995)}to{opacity:1;transform:none}}
@keyframes wb-deck-cover{from{opacity:.18;transform:scale(1.035)}to{opacity:.44;transform:scale(1)}}
@keyframes wb-deck-scan{from{transform:translateX(-120%)}to{transform:translateX(120%)}}
@keyframes wb-deck-row-in{from{opacity:0;transform:translateX(6px)}to{opacity:1;transform:none}}
@keyframes wb-deck-ring{0%{opacity:.8;transform:scale(.7)}75%,100%{opacity:0;transform:scale(1.65)}}
@keyframes wb-hero-in{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:none}}
.wb-wall-kicker{animation:wb-hero-in .48s var(--wb-ease-out) both}
.wb-wall-headline{animation:wb-hero-in .56s .05s var(--wb-ease-out) both}
.wb-wall-actions{animation:wb-hero-in .5s .1s var(--wb-ease-out) both}
.wb-wall-facts{animation:wb-hero-in .5s .14s var(--wb-ease-out) both}
.wb-lifecycle-switch{animation:wb-hero-in .45s .18s var(--wb-ease-out) both}

/* Project room: a project is a place with a masthead, chapters and a working surface. */
.wb-room{--wb-room-accent:var(--dsw-alias-brand-primary);animation:wb-room-enter .46s var(--wb-ease-out) both;background:
  radial-gradient(100% 60% at 8% 0%,color-mix(in srgb,var(--wb-room-accent) 8%,transparent),transparent 62%),
  var(--dsw-alias-bg-base);min-height:100%;display:flex;flex-direction:column}
.wb-room-top{display:flex;align-items:center;gap:12px;padding:13px 26px;border-bottom:1px solid var(--dsw-alias-border-l1);position:sticky;top:0;z-index:6;background:color-mix(in srgb,var(--dsw-alias-bg-base) 86%,transparent);backdrop-filter:blur(16px)}
.wb-room-back{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 74%,transparent);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;padding:7px 11px;transition:border-color .18s ease,color .18s ease,background .18s ease}
.wb-room-back:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2)}
.wb-room-back svg{transform:rotate(180deg)}
.wb-room-wheel-hint{display:inline-flex;align-items:center;gap:5px;font-size:9px;letter-spacing:.01em;color:var(--dsw-alias-label-tertiary);white-space:nowrap;pointer-events:none}
.wb-room-wheel-hint svg{opacity:.72}
.wb-room-crumb{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--dsw-alias-label-tertiary);min-width:0}
.wb-room-crumb span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb-room-top-actions{margin-left:auto;display:flex;align-items:center;gap:7px}
.wb-room-masthead{position:relative;display:grid;grid-template-columns:minmax(0,1.25fr) minmax(160px,.42fr) minmax(230px,.72fr);gap:28px;align-items:end;padding:30px 30px 26px;border-bottom:1px solid var(--dsw-alias-border-l1);overflow:hidden}
.wb-room-masthead:before{content:"";position:absolute;inset:0;background:radial-gradient(80% 100% at 0% 0%,color-mix(in srgb,var(--wb-room-accent) 12%,transparent),transparent 60%);pointer-events:none}
.wb-room-identity{position:relative;z-index:1;min-width:0}
.wb-room-kicker{display:flex;align-items:center;gap:8px;font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary);margin-bottom:14px}
.wb-room-count{font-size:9px;font-weight:600;border-radius:999px;padding:1px 5px;background:color-mix(in srgb,var(--wb-room-accent) 12%,var(--dsw-alias-bg-layer-3));color:var(--dsw-alias-label-secondary)}
.wb-room-mark{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:color-mix(in srgb,var(--wb-room-accent) 16%,var(--dsw-alias-bg-layer-2));border:1px solid color-mix(in srgb,var(--wb-room-accent) 30%,var(--dsw-alias-border-l1));color:color-mix(in srgb,var(--wb-room-accent) 72%,var(--dsw-alias-label-primary));font-size:13px;font-weight:600;letter-spacing:-.04em}
.wb-room-title{view-transition-name:wb-project-morph;margin:0;font-size:clamp(32px,3.4vw,56px);line-height:1.02;letter-spacing:-.055em;font-weight:610;overflow-wrap:anywhere}
.wb-room-title:focus{outline:none}
.wb-room-path{margin-top:11px;font-size:11px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:720px}
.wb-room-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:14px}
.wb-room-vitals{position:relative;z-index:1;display:flex;flex-direction:column;gap:9px;padding-bottom:4px}
.wb-room-vital{display:flex;flex-direction:column;gap:1px;border-left:1px solid var(--dsw-alias-border-l2);padding-left:10px}
.wb-room-vital span{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}
.wb-room-vital b{font-size:12px;font-weight:550;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb-room-preview{position:relative;z-index:1;align-self:stretch;min-height:150px;border:1px solid var(--dsw-alias-border-l2);border-radius:14px;overflow:hidden;background:var(--dsw-alias-bg-layer-2);display:flex;flex-direction:column}
.wb-room-preview-media{position:relative;flex:1;min-height:110px;overflow:hidden}
.wb-room-preview-media img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.wb-room-preview-cap{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;font-size:10px;color:var(--dsw-alias-label-tertiary);border-top:1px solid var(--dsw-alias-border-l1);background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 72%,transparent)}
.wb-room-preview-empty{flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:5px;color:var(--dsw-alias-label-tertiary);font-size:9px}
.wb-room-preview-empty b{font-size:22px;font-weight:500;letter-spacing:-.06em;color:color-mix(in srgb,var(--wb-room-accent) 60%,var(--dsw-alias-label-primary))}
.wb-room-chapters{display:flex;align-items:stretch;gap:0;padding:0 26px;border-bottom:1px solid var(--dsw-alias-border-l1);background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 72%,transparent);position:sticky;top:50px;z-index:5;backdrop-filter:blur(14px)}
.wb-room-chapter{display:flex;align-items:baseline;gap:7px;border:0;border-bottom:2px solid transparent;background:none;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:12px;padding:15px 18px 13px;cursor:pointer;white-space:nowrap;transition:color .18s,border-color .18s}
.wb-room-chapter:first-child{padding-left:0}
.wb-room-chapter small{font-size:10px;letter-spacing:.08em;opacity:.72}
.wb-room-chapter:hover{color:var(--dsw-alias-label-primary)}
.wb-room-chapter.on{color:var(--dsw-alias-label-primary);border-bottom-color:var(--wb-room-accent)}

.wb-room .wb-ws-body{padding:20px 24px 34px;gap:18px}
.wb-room .wb-ws-pane{animation:wb-room-pane .24s var(--wb-ease-out) both}
.wb-room .wb-ws-pane.is-forward{animation-name:wb-room-pane-forward}
.wb-room .wb-ws-pane.is-back{animation-name:wb-room-pane-back}
@keyframes wb-room-pane{from{opacity:0;transform:translateX(8px)}to{opacity:1;transform:none}}
@keyframes wb-room-pane-forward{from{opacity:0;transform:translateX(10px)}to{opacity:1;transform:none}}
@keyframes wb-room-pane-back{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:none}}
.wb-room-command{display:flex;flex-direction:column;gap:8px;border:1px solid color-mix(in srgb,var(--wb-room-accent) 26%,var(--dsw-alias-border-l1));border-radius:14px;padding:14px 16px;background:linear-gradient(110deg,color-mix(in srgb,var(--wb-room-accent) 7%,var(--dsw-alias-bg-layer-1)),var(--dsw-alias-bg-layer-1))}
.wb-room-command-head{display:flex;align-items:baseline;gap:8px}
.wb-room-command-head span{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}
.wb-room-command-head b{font-size:14px;font-weight:560}
.wb-room-command-row{display:flex;align-items:flex-end;gap:8px}
.wb-room-command-row textarea{flex:1;min-height:52px;resize:vertical}
.wb-room-command-hint{font-size:10px;color:var(--dsw-alias-label-tertiary)}
.wb-room-task{display:flex;align-items:center;gap:12px;border-top:1px solid var(--dsw-alias-border-l1);padding-top:12px}
.wb-room-task-copy{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.wb-room-task-copy strong{font-size:12px;font-weight:550}
.wb-room-task-copy p{margin:0;font-size:9px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb-room-task-actions{display:flex;gap:6px;flex:0 0 auto}
.wb-room-memory{display:flex;flex-direction:column;gap:5px}
.wb-room-memory-path{font-size:9px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb-room-memory-row{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--dsw-alias-label-secondary)}
.wb-room-memory-row b{font-weight:550;color:var(--dsw-alias-label-primary)}
.wb-room-memory-empty{font-size:10px;line-height:1.55;color:var(--dsw-alias-label-tertiary)}
.wb-room-memory-actions{display:flex;gap:5px;margin-top:3px}
.wb-room-masthead.is-no-preview{grid-template-columns:minmax(0,1.45fr) minmax(190px,.36fr);align-items:end}
.wb-room .wb-ws-overview-grid{grid-template-columns:1fr;gap:0}
.wb-room .wb-ws-overview-main{gap:0}
.wb-room .wb-ws-side{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:24px;align-items:start;border-top:1px solid var(--dsw-alias-border-l1);padding-top:20px}
.wb-room .wb-ws-side-card{border:0;border-top:1px solid var(--dsw-alias-border-l1);border-radius:0;background:none;padding:16px 0 0}
.wb-room .wb-ws-side-card:first-child{border-top:0;padding-top:0}
.wb-room .wb-ws-section{border:0;border-top:1px solid var(--dsw-alias-border-l1);border-radius:0;background:none;padding:22px 0 8px}
.wb-room .wb-ws-section:first-child{border-top:0;padding-top:0}
.wb-room .wb-ws-section-head{margin-bottom:16px}
.wb-room .wb-ws-section-head h2{font-size:11px;letter-spacing:.16em}
.wb-room-command{border:0;border-radius:0;border-bottom:1px solid var(--dsw-alias-border-l1);background:none;padding:0 0 20px;gap:10px}
.wb-room-command-head b{font-size:21px;font-weight:560;letter-spacing:-.035em}
.wb-room-command-head span{font-size:9px;letter-spacing:.16em}
.wb-room-command-row textarea{min-height:54px;border:0;border-radius:0;border-bottom:1px solid var(--dsw-alias-border-l2);background:transparent;padding:8px 0;font-size:15px;line-height:1.5}
.wb-room-command-row textarea:focus{border-bottom-color:var(--wb-room-accent);outline:none}
.wb-room-command-hint{font-size:9px;letter-spacing:.02em}
.wb-room-preview{border:0;border-left:1px solid var(--dsw-alias-border-l1);border-radius:0;background:none;padding-left:14px;min-height:0}
.wb-room .wb-ws-empty.small{min-height:0;border:0;border-radius:0;padding:10px 0;color:var(--dsw-alias-label-tertiary)}
.wb-room .wb-ws-note{border:0;border-radius:0;border-bottom:1px solid var(--dsw-alias-border-l2);background:transparent;padding:8px 0;min-height:64px}
.wb-room .wb-ws-note:focus{border-bottom-color:var(--wb-room-accent);outline:none}
.wb-room-vitals{gap:12px;max-width:260px}
.wb-room-vital b{font-size:12px}
.wb-handoff-persist{display:flex;flex-direction:column;gap:5px;border:1px solid color-mix(in srgb,var(--dsw-alias-brand-primary) 24%,var(--dsw-alias-border-l1));border-radius:10px;padding:9px 11px;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 5%,transparent)}
.wb-handoff-persist .wb-check{font-size:11px;font-weight:550;align-items:center}
.wb-handoff-agents{margin-left:16px;font-size:10px!important;font-weight:400!important;color:var(--dsw-alias-label-tertiary)}
.wb-source-warning{display:flex;flex-direction:column;gap:5px;border:1px solid color-mix(in srgb,var(--dsw-alias-state-warn-primary) 34%,var(--dsw-alias-border-l1));background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 7%,transparent);border-radius:9px;padding:8px 10px;font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary)}
.wb-source-warning span{display:flex;align-items:flex-start;gap:6px}
.wb-handoff-history{border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:12px 13px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 64%,transparent)}
.wb-handoff-record-list{display:flex;flex-direction:column;gap:8px;margin-top:9px}
.wb-handoff-record{border:1px solid var(--dsw-alias-border-l1);border-radius:9px;padding:8px 9px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 78%,transparent)}
.wb-handoff-record-head{display:flex;align-items:center;gap:7px;min-width:0}
.wb-handoff-record-head b{font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.wb-handoff-record-head>span:last-child{margin-left:auto;font-size:10px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.wb-handoff-record-meta{display:flex;gap:8px;align-items:center;margin-top:4px;font-size:10px;color:var(--dsw-alias-label-tertiary);min-width:0}
.wb-handoff-record-meta code{font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.wb-handoff-record-goal{margin:5px 0 0;font-size:11px;line-height:17px;color:var(--dsw-alias-label-secondary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.wb-handoff-record-actions{display:flex;gap:6px;margin-top:6px}
.wb-handoff-record-actions .wb-btn{font-size:10px;padding:2px 8px;min-height:22px}
.wb-chip.is-handoff-prefilled{color:var(--dsw-alias-label-secondary);border-color:var(--dsw-alias-border-l2)}
.wb-chip.is-handoff-sent{color:var(--dsw-alias-brand-primary);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 42%,var(--dsw-alias-border-l1))}
.wb-chip.is-handoff-running{color:var(--dsw-alias-state-warn-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 42%,var(--dsw-alias-border-l1))}
.wb-chip.is-handoff-completed{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 42%,var(--dsw-alias-border-l1))}
.wb-chip.is-handoff-failed{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 42%,var(--dsw-alias-border-l1))}
@media (max-width:1240px){.wb-wall-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.wb-wall-card.is-feature{grid-column:span 2;grid-row:span 1;min-height:320px}.wb-room-masthead{grid-template-columns:minmax(0,1.2fr) minmax(230px,.8fr)}.wb-room-vitals{display:none}}
@media (min-width:2200px){.wb-shell{width:100%;max-width:2300px;margin:0 auto}.wb-header-inner{max-width:2300px}.wb-wall-title{font-size:clamp(58px,2.6vw,76px)}.wb-wall-sub{font-size:14px}.wb-deck-grid{grid-template-columns:minmax(0,1.18fr) minmax(0,1fr)}.wb-deck-stage-name{font-size:clamp(44px,2.2vw,60px)}.wb-deck-row-main b{font-size:12px}.wb-deck-row-main small{font-size:9px}.wb-terrain-plot{min-height:600px}}
@media (min-width:1800px){.wb-header-inner,.wb-shell{max-width:2400px}.wb-wall-grid{grid-template-columns:repeat(6,minmax(0,1fr))}.wb-wall-rest-list{grid-template-columns:repeat(3,minmax(0,1fr))}.wb-room .wb-ws-body{max-width:2200px;padding-left:34px;padding-right:34px}.wb-room-masthead{padding-left:max(30px,calc((100% - 2200px)/2));padding-right:max(30px,calc((100% - 2200px)/2))}.wb-room-top{padding-left:max(20px,calc((100% - 2200px)/2));padding-right:max(20px,calc((100% - 2200px)/2))}.wb-room-chapters{padding-left:max(0px,calc((100% - 2200px)/2));padding-right:max(0px,calc((100% - 2200px)/2))}.wb-ws-followup{padding-left:max(20px,calc((100% - 2200px)/2));padding-right:max(20px,calc((100% - 2200px)/2))}}
@media (min-width:2600px){.wb-header-inner,.wb-shell{max-width:2300px}.wb-wall-grid{grid-template-columns:repeat(7,minmax(0,1fr))}.wb-wall-name{font-size:16px}.wb-wall-card.is-feature .wb-wall-name{font-size:44px}.wb-room .wb-ws-body{max-width:2600px}.wb-room-masthead{padding-left:max(30px,calc((100% - 2600px)/2));padding-right:max(30px,calc((100% - 2600px)/2))}.wb-room-top{padding-left:max(20px,calc((100% - 2600px)/2));padding-right:max(20px,calc((100% - 2600px)/2))}.wb-room-chapters{padding-left:max(0px,calc((100% - 2600px)/2));padding-right:max(0px,calc((100% - 2600px)/2))}.wb-ws-followup{padding-left:max(20px,calc((100% - 2600px)/2));padding-right:max(20px,calc((100% - 2600px)/2))}.wb-room-title{font-size:clamp(40px,2.4vw,64px)}}
@media (max-width:980px){.wb-wall-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.wb-wall-card.is-feature{grid-column:span 2;grid-row:span 1;min-height:320px}.wb-wall-rest-list{grid-template-columns:1fr}.wb-room-masthead{grid-template-columns:1fr;gap:18px}.wb-room-preview{min-height:180px}.wb-room .wb-ws-overview-grid{grid-template-columns:1fr}.wb-room .wb-ws-side{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:680px){.wb-room-top{position:relative}.wb-room-chapters{top:0}.wb-wall-hero{grid-template-columns:1fr;grid-template-areas:"kicker" "headline" "actions" "facts";align-items:start}.wb-wall-actions{justify-content:flex-start}.wb-wall-facts{justify-content:flex-start}.wb-wall-grid{grid-template-columns:1fr}.wb-wall-card.is-feature{grid-column:span 1}.wb-wall-card.is-wide{grid-template-columns:1fr;min-height:0}.wb-wall-card.is-wide .wb-wall-visual{min-height:180px}.wb-wall-rest-list{grid-template-columns:1fr}.wb-room-top{padding:10px 14px;flex-wrap:wrap}.wb-room-top-actions{width:100%;margin-left:0}.wb-room-masthead{padding:20px 16px}.wb-room-chapters{overflow-x:auto;padding:0 14px}.wb-room-chapter{padding:13px 10px 11px}.wb-room .wb-ws-body{padding:14px 14px 28px}.wb-room-command-row{align-items:stretch;flex-direction:column}.wb-room-task{align-items:flex-start;flex-direction:column}.wb-room-task-actions{width:100%}.wb-room-task-actions .wb-btn{flex:1}.wb-room .wb-ws-side{grid-template-columns:1fr}}
@media (max-width:1180px){.wb-deck-grid{grid-template-columns:1fr}.wb-deck-queue{max-height:390px}.wb-deck-stage{min-height:500px}}
@media (min-width:761px) and (max-width:1180px){.wb-wall-facts{display:none}}
@media (min-width:761px) and (max-height:960px){
  .wb-wall-page{gap:8px;padding-top:0}
  .wb-wall-hero{padding:6px 2px 0;gap:6px 20px}
  .wb-wall-title{font-size:clamp(30px,3.2vw,44px)}
  .wb-wall-sub{margin-top:6px;font-size:12px}
  .wb-wall-facts b{font-size:19px}
  .wb-lifecycle-switch{padding:5px 0}
  .wb-deck{gap:8px}
  .wb-deck-ribbon{padding:8px 12px 7px}
  .wb-deck-bars{height:32px}
  .wb-deck-stage{min-height:388px}
  .wb-deck-stage-copy{gap:8px;padding:18px 22px 15px}
  .wb-deck-stage-name{font-size:clamp(28px,2.8vw,40px)}
  .wb-deck-stage-note{-webkit-line-clamp:2;font-size:11px}
  .wb-deck-readout{padding:9px 0 8px}
  .wb-deck-stage-metrics{padding-top:9px}
  .wb-deck-queue{max-height:388px}
  .wb-deck-queue-head{padding:11px 13px 8px}
  .wb-deck-row{padding:5px 5px 5px 7px}
  .wb-deck-stage-hint{display:none}
}
@media (min-width:761px) and (max-width:1180px) and (max-height:960px){.wb-deck-stage-visual{height:160px;min-height:160px;max-height:160px}}
@media (max-width:760px){.wb-deck-ribbon{grid-template-columns:1fr;gap:9px}.wb-deck-stage{grid-template-columns:1fr;min-height:0}.wb-deck-stage-visual{min-height:230px}.wb-deck-stage-copy{padding:20px 18px}.wb-deck-stage-name{max-width:none}.wb-deck-stage-metrics{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px 0}.wb-deck-queue{max-height:360px}.wb-deck-bars{height:34px}}
@media (prefers-reduced-motion:reduce){.wb-scene-enter{animation:none!important}.wb-wall-card{animation:none}.wb-wall-card,.wb-wall-cover,.wb-wall-arrow{transition:none}.wb-room .wb-ws-pane{animation:none}.wb-deck,.wb-deck-stage,.wb-deck-bar,.wb-deck-row,.wb-deck-stage-cover,.wb-deck-stage-scan,.wb-wall-kicker,.wb-wall-headline,.wb-wall-actions,.wb-wall-facts,.wb-lifecycle-switch{animation:none!important}.wb-deck-bar,.wb-deck-row,.wb-deck-pipe i{transition:none}}
/* Project room v1.22: an editorial cockpit, not a stack of cards. */
.wb-room-masthead{grid-template-columns:minmax(0,1fr) minmax(250px,310px);grid-template-areas:"identity preview" "vitals preview";column-gap:28px;row-gap:18px;align-items:start;padding:26px 30px 24px;animation:wb-room-rise .5s var(--wb-ease-out) both}
.wb-room-identity{grid-area:identity}
.wb-room-kicker{margin-bottom:10px}
.wb-room-vitals{grid-area:vitals;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;padding:0;max-width:none}
.wb-room-vital{gap:4px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:9px 11px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 68%,transparent);min-width:0}
.wb-room-vital span{font-size:8px;letter-spacing:.09em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-room-vital b{font-size:12px;font-weight:560}
.wb-room-preview{grid-area:preview;width:100%;min-height:200px;border-radius:16px;padding:0;font:inherit;color:inherit;text-align:left;cursor:pointer;box-shadow:0 22px 46px -34px color-mix(in srgb,var(--wb-room-accent) 55%,#000);transition:transform .2s var(--wb-ease-out),border-color .2s,box-shadow .2s}
.wb-room-preview-media{min-height:150px}
.wb-room-preview:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--wb-room-accent) 38%,var(--dsw-alias-border-l1));box-shadow:0 28px 52px -34px color-mix(in srgb,var(--wb-room-accent) 70%,#000)}
.wb-room-preview:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.wb-room-preview-open{display:inline-flex;align-items:center;gap:3px;color:color-mix(in srgb,var(--wb-room-accent) 72%,var(--dsw-alias-label-primary));white-space:nowrap}
.wb-room-preview-open svg{transition:transform .18s var(--wb-ease-out)}
.wb-room-preview:hover .wb-room-preview-open svg{transform:translateX(2px)}
.wb-room-masthead.is-no-preview{grid-template-columns:minmax(0,1fr);grid-template-areas:"identity" "vitals";align-items:start}
.wb-room-chapters{gap:2px;padding:6px 26px 0;background:color-mix(in srgb,var(--dsw-alias-bg-base) 88%,transparent);top:65px;backdrop-filter:blur(16px)}
.wb-room .wb-ws-body{padding:22px 24px 40px;gap:20px;background:radial-gradient(80% 40% at 50% 0%,color-mix(in srgb,var(--wb-room-accent) 4%,transparent),transparent 70%)}
.wb-room-command{border:1px solid color-mix(in srgb,var(--wb-room-accent) 30%,var(--dsw-alias-border-l1));border-radius:18px;padding:20px 22px 18px;gap:10px;background:linear-gradient(135deg,color-mix(in srgb,var(--wb-room-accent) 9%,var(--dsw-alias-bg-layer-1)) 0%,var(--dsw-alias-bg-layer-1) 54%);box-shadow:0 24px 50px -38px color-mix(in srgb,var(--wb-room-accent) 65%,#000);animation:wb-room-rise .46s .04s var(--wb-ease-out) both}
.wb-room-command-head{flex-direction:column;align-items:flex-start;gap:3px}
.wb-room-command-head span{font-size:9px;letter-spacing:.16em}
.wb-room-command-head b{font-size:24px;font-weight:580;letter-spacing:-.04em}
.wb-room-command-row{align-items:stretch;gap:10px}
.wb-room-command-row textarea{min-height:74px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:color-mix(in srgb,var(--dsw-alias-bg-base) 54%,transparent);padding:11px 13px;font-size:14px;line-height:1.55;transition:border-color .18s,box-shadow .18s}
.wb-room-command-row textarea:focus{border-color:var(--wb-room-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--wb-room-accent) 13%,transparent);outline:none}
.wb-room-command .wb-btn.primary{align-self:flex-end;min-height:42px;padding:0 18px;white-space:nowrap}
.wb-room-command-hint{font-size:10px;letter-spacing:.01em}
.wb-room-task{gap:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:11px 13px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 64%,transparent);margin-top:2px}
.wb-room-task-copy strong{font-size:12px;font-weight:580}
.wb-room-task-copy p{font-size:10px}
.wb-room .wb-ws-side{grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:18px;border-top:0;padding-top:0}
.wb-room .wb-ws-side-card{border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 64%,transparent);padding:16px}
.wb-room .wb-ws-side-card:first-child{border:1px solid var(--dsw-alias-border-l1);padding-top:16px}
.wb-room .wb-ws-section{border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 62%,transparent);padding:17px 18px 16px;box-shadow:0 14px 34px -32px #000;animation:wb-room-rise .44s var(--wb-ease-out) both}
.wb-room .wb-ws-section:first-child{border:1px solid var(--dsw-alias-border-l1);padding-top:17px}
.wb-room .wb-ws-section:nth-child(2){animation-delay:.05s}
.wb-room .wb-ws-section:nth-child(3){animation-delay:.09s}
.wb-room .wb-ws-section:nth-child(4){animation-delay:.13s}
.wb-room .wb-ws-section-head{margin-bottom:13px;padding-bottom:9px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.wb-room .wb-ws-section-head h2{font-size:12px;letter-spacing:.06em;font-weight:580}
.wb-room .wb-ws-pane{animation:wb-room-pane .28s var(--wb-ease-out) both}
@keyframes wb-room-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes wb-room-enter{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
@keyframes wb-room-zoom-back{from{opacity:1;transform:scale(1) translateY(0)}to{opacity:0;transform:scale(.965) translateY(8px)}}
.wb-room.is-zooming-back{animation:wb-room-zoom-back .2s var(--wb-ease-out) both;transform-origin:50% 28%}
/* Project field v1.22: a compact briefing + a working rail, not a stack of cards. */
.wb-room-masthead{min-height:0;padding:20px 28px 18px;grid-template-columns:minmax(0,1fr) minmax(268px,310px);column-gap:26px;row-gap:12px}
.wb-room-identity{display:flex;flex-direction:column;justify-content:flex-end;min-height:176px}
.wb-room-kicker{margin-bottom:8px}
.wb-room-mark{width:34px;height:34px;border-radius:10px;font-size:11px}
.wb-room-title{font-size:clamp(30px,2.7vw,44px);line-height:1.04;letter-spacing:-.05em}
.wb-room-path{margin-top:9px;font-size:10px}
.wb-room-chips{margin-top:10px;gap:4px}
.wb-room-vitals{grid-template-columns:repeat(4,minmax(0,1fr));gap:0;padding-top:9px;border-top:1px solid var(--dsw-alias-border-l1)}
.wb-room-vital{border:0;border-left:1px solid var(--dsw-alias-border-l2);border-radius:0;background:none;padding:0 12px}
.wb-room-vital:first-child{border-left:0;padding-left:0}
.wb-room-vital span{font-size:8px}
.wb-room-vital b{font-size:11.5px}
.wb-room-preview{min-height:200px;border-radius:14px}
.wb-room-preview-media{min-height:160px}
.wb-room .wb-ws-pane.is-overview{display:block}
.wb-room .wb-ws-pane.is-overview .wb-room-command{margin:0 0 18px;border-radius:16px;padding:16px 18px 14px;gap:8px}
.wb-room .wb-ws-pane.is-overview .wb-ws-overview-grid{display:grid;grid-template-columns:minmax(0,1.52fr) minmax(294px,.72fr);gap:20px;align-items:start}
.wb-room .wb-ws-pane.is-overview .wb-ws-overview-main{min-width:0;gap:18px}
.wb-room .wb-ws-pane.is-overview .wb-ws-side{display:grid;grid-template-columns:1fr;gap:14px;align-self:start}
.wb-room .wb-ws-pane.is-overview .wb-ws-side-card{transition:border-color .18s ease,transform .18s var(--wb-ease-out)}
.wb-room .wb-ws-pane.is-overview .wb-ws-side-card:hover{border-color:color-mix(in srgb,var(--wb-room-accent) 30%,var(--dsw-alias-border-l1));transform:translateY(-1px)}
.wb-room-command-head b{font-size:21px}
.wb-room-command-row textarea{min-height:64px;font-size:13px;padding:9px 11px}
.wb-room-command .wb-btn.primary{min-height:38px;padding:0 15px}
.wb-room-compose-toggle{display:inline-flex;align-items:center;gap:6px;align-self:flex-start;margin:1px 0 0;border:1px dashed color-mix(in srgb,var(--wb-room-accent) 32%,var(--dsw-alias-border-l2));border-radius:999px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:10px;line-height:24px;padding:0 10px;cursor:pointer;transition:border-color .18s,color .18s,background .18s}
.wb-room-compose-toggle:hover,.wb-room-compose-toggle.is-open{border-color:color-mix(in srgb,var(--wb-room-accent) 58%,var(--dsw-alias-border-l2));color:var(--wb-room-accent);background:color-mix(in srgb,var(--wb-room-accent) 7%,transparent)}
.wb-room-compose-toggle svg{opacity:.72}
.wb-room .wb-ws-pane.is-overview .wb-room-memory{order:1}
.wb-room .wb-ws-pane.is-overview .wb-room-details{order:2}
.wb-room .wb-ws-pane.is-overview .wb-room-tags{order:3}
.wb-room .wb-ws-pane.is-overview .wb-room-relations{order:4}
.wb-room .wb-ws-pane.is-overview .wb-room-contract{order:5}
.wb-room-contract summary{display:flex;align-items:center;gap:8px;margin:0;list-style:none;cursor:pointer;user-select:none}
.wb-room-contract summary::-webkit-details-marker{display:none}
.wb-room-contract summary:after{content:'+';flex:0 0 auto;font-size:13px;line-height:1;color:var(--dsw-alias-label-tertiary);transition:transform .18s,color .18s}
.wb-room-contract[open] summary:after{content:'−';color:var(--wb-room-accent)}
.wb-room-contract summary:hover:after{color:var(--wb-room-accent)}
.wb-contract-body{padding-top:9px;animation:wb-room-enter .2s var(--wb-ease-out) both}
.wb-room .wb-ws-pane.is-overview .wb-ws-section{border:0;border-top:1px solid var(--dsw-alias-border-l1);border-radius:0;background:none;box-shadow:none;padding:16px 2px 0}
.wb-room .wb-ws-pane.is-overview .wb-room-command + .wb-ws-section{border-top:0;padding-top:2px}
.wb-room-top:after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:1px;background:linear-gradient(90deg,var(--wb-room-accent),color-mix(in srgb,var(--wb-room-accent) 22%,transparent));transform:scaleX(var(--wb-room-scroll,0));transform-origin:0 50%;transition:transform .12s linear}
.wb-room-preview-media img{will-change:transform;transform:scale(var(--wb-room-cover-scale,1.02)) translateY(var(--wb-room-cover-shift,0px));transition:transform .12s linear}
.wb-room-chips .wb-status-pill .wb-dot{animation:wb-room-pulse 2.8s ease-in-out infinite}
.wb-room-command-row{animation:wb-room-compose .24s var(--wb-ease-out) both}
@keyframes wb-room-pulse{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--wb-room-accent) 28%,transparent)}50%{box-shadow:0 0 0 5px transparent}}
@keyframes wb-room-compose{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:none}}
@keyframes wb-room-section-in{from{opacity:.01;transform:translateY(16px)}to{opacity:1;transform:none}}
.wb-room .wb-ws-pane.is-overview .wb-ws-section.is-revealed{animation:wb-room-section-in .5s var(--wb-ease-out) both}
@media (prefers-reduced-motion:reduce){.wb-room-top:after,.wb-room-preview-media img,.wb-room-chips .wb-status-pill .wb-dot,.wb-room-command-row,.wb-room .wb-ws-pane.is-overview .wb-ws-section{animation:none!important;transition:none!important}.wb-room-top:after{transform:scaleX(var(--wb-room-scroll,0))!important}.wb-room-preview-media img{transform:scale(1.02)!important}.wb-room-command-row,.wb-room .wb-ws-pane.is-overview .wb-ws-section{transform:none!important}}
@media (max-width:1240px){.wb-room-masthead{grid-template-columns:minmax(0,1fr) 260px}.wb-room-vitals{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 0}.wb-room-vital:nth-child(3){border-left:0;padding-left:0}.wb-room .wb-ws-pane.is-overview .wb-ws-overview-grid{grid-template-columns:minmax(0,1fr) minmax(280px,.7fr)}}
@media (max-width:920px){.wb-room .wb-ws-pane.is-overview .wb-ws-overview-grid{grid-template-columns:1fr;gap:16px}.wb-room .wb-ws-pane.is-overview .wb-ws-side{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:840px){.wb-room-masthead{grid-template-columns:1fr;grid-template-areas:"identity" "vitals" "preview";gap:14px}.wb-room-identity{min-height:0}.wb-room-vitals{grid-template-columns:repeat(2,minmax(0,1fr))}.wb-room .wb-ws-pane.is-overview .wb-ws-overview-grid{grid-template-columns:1fr}.wb-room .wb-ws-pane.is-overview .wb-ws-side{grid-template-columns:1fr}}
@media (max-width:680px){.wb-room-compose-toggle{width:100%;justify-content:center}.wb-room .wb-ws-pane.is-overview .wb-room-command{padding:14px}}
@media (max-width:980px){.wb-root.is-scene-mode .wb-main{overflow:hidden}.wb-root.is-scene-mode .wb-shell{height:100%;min-height:0}.wb-root.is-scene-mode .wb-project-page{min-height:0;overflow:hidden}.wb-root.is-scene-mode .wb-earth,.wb-root.is-scene-mode .wb-studio,.wb-root.is-scene-mode .wb-library,.wb-root.is-scene-mode .wb-time{height:100%;min-height:0;max-height:none;overflow:auto}.wb-root.is-scene-mode .wb-earth{overflow:hidden}.wb-root.is-scene-mode .wb-earth-stage{height:auto;min-height:0}}
@media (max-width:980px){.wb-room-masthead{grid-template-columns:minmax(0,1fr) 250px;grid-template-areas:"identity preview" "vitals preview";column-gap:20px}.wb-room-preview{min-height:190px}}
@media (max-width:980px){.wb-room-wheel-hint{display:none}}
@media (max-width:840px){.wb-room-masthead{grid-template-columns:1fr;grid-template-areas:"identity" "vitals" "preview";gap:16px}.wb-room-vitals{grid-template-columns:repeat(2,minmax(0,1fr))}.wb-room-preview{min-height:160px}}
@media (max-width:680px){.wb-room-vitals{grid-template-columns:1fr 1fr}.wb-room-command-row{flex-direction:column;align-items:stretch}.wb-room-command .wb-btn.primary{align-self:stretch}.wb-room-task{align-items:flex-start;flex-direction:column}.wb-room-task-actions{width:100%}.wb-room-task-actions .wb-btn{flex:1}}
@media (prefers-reduced-motion:reduce){.wb-room,.wb-room.is-zooming-back,.wb-room-masthead,.wb-room-command,.wb-room .wb-ws-section,.wb-room .wb-ws-pane{animation:none}}

/* Project field v1.24: one continuous site, not a dashboard of cards. */
.wb-room.wb-field{--wb-field-line:color-mix(in srgb,var(--dsw-alias-border-l1) 88%,transparent);background:
  radial-gradient(120% 74% at 6% -8%,color-mix(in srgb,var(--wb-room-accent) 11%,transparent),transparent 58%),
  linear-gradient(180deg,color-mix(in srgb,var(--dsw-alias-bg-base) 96%,#000),var(--dsw-alias-bg-base));animation:wb-field-enter .52s var(--wb-ease-out)}
.wb-room.wb-field .wb-room-top{padding:11px 26px;gap:10px;background:color-mix(in srgb,var(--dsw-alias-bg-base) 84%,transparent);border-bottom-color:var(--wb-field-line);flex-wrap:nowrap}
.wb-room.wb-field .wb-room-back{padding:6px 11px;white-space:nowrap;flex:0 0 auto}
.wb-room.wb-field .wb-room-crumb{min-width:0}
.wb-room.wb-field .wb-room-top-actions{flex:0 0 auto}
.wb-room.wb-field .wb-room-title{font-size:clamp(42px,4.6vw,70px);line-height:.94;letter-spacing:-.065em;font-weight:610;text-wrap:pretty;text-shadow:0 2px 26px rgba(0,0,0,.36)}
.wb-room.wb-field .wb-room-path{margin-top:14px;max-width:680px;font-size:10px;letter-spacing:.015em}
.wb-room.wb-field .wb-room-chips{margin-top:16px;gap:6px}
.wb-room.wb-field .wb-room-chips .wb-chip{backdrop-filter:blur(10px);background:color-mix(in srgb,var(--dsw-alias-bg-base) 54%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-border-l2) 72%,transparent)}

.wb-room.wb-field .wb-field-hero{position:relative;min-height:342px;overflow:hidden;border-bottom:1px solid var(--wb-field-line);isolation:isolate;background:#070a0c}
.wb-room.wb-field .wb-field-media{position:absolute;z-index:0;inset:0 0 0 auto;width:56%;margin:0;padding:0;border:0;border-left:1px solid rgba(255,255,255,.06);background:radial-gradient(90% 100% at 70% 40%,#1a2024,#080b0d 76%);color:inherit;text-align:left;cursor:pointer;overflow:hidden;transform:translateY(var(--wb-room-cover-shift,0)) scale(var(--wb-room-cover-scale,1.02));transform-origin:68% 50%;will-change:transform}
.wb-room.wb-field .wb-field-media.is-empty{width:48%;cursor:default;background:
  repeating-linear-gradient(116deg,transparent 0 27px,rgba(223,235,239,.045) 28px,transparent 29px),
  radial-gradient(90% 100% at 72% 42%,color-mix(in srgb,var(--wb-room-accent) 22%,#12181b),#080b0d 72%)}
.wb-room.wb-field .wb-field-media img{position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:cover;transform:scale(1.035);animation:wb-field-cover .72s var(--wb-ease-out) both;mask-image:linear-gradient(90deg,transparent 0%,rgba(0,0,0,.45) 15%,#000 44%,#000 100%);-webkit-mask-image:linear-gradient(90deg,transparent 0%,rgba(0,0,0,.45) 15%,#000 44%,#000 100%)}
.wb-room.wb-field .wb-field-media:after{content:"";position:absolute;inset:0;background:linear-gradient(0deg,rgba(5,8,10,.82),transparent 44%),linear-gradient(90deg,rgba(5,8,10,.18),transparent 42%);pointer-events:none}
.wb-room.wb-field .wb-field-media-fallback{position:absolute;z-index:0;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;color:rgba(235,242,244,.28);font-size:9px;letter-spacing:.12em;text-transform:uppercase}
.wb-room.wb-field .wb-field-media-fallback b{font-size:38px;font-weight:500;letter-spacing:-.08em;color:rgba(235,242,244,.34)}
.wb-room.wb-field .wb-field-media-caption{position:absolute;z-index:2;right:26px;bottom:72px;left:26px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:9px;letter-spacing:.04em;color:rgba(238,245,247,.54);text-transform:none}
.wb-room.wb-field .wb-field-media-caption span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb-room.wb-field .wb-field-media-caption span:last-child{flex:0 0 auto}
.wb-room.wb-field .wb-field-media-mark{position:absolute;right:12%;top:17%;font-size:clamp(90px,13vw,170px);line-height:.8;font-weight:500;letter-spacing:-.1em;color:color-mix(in srgb,var(--wb-room-accent) 25%,transparent)}
.wb-room.wb-field .wb-field-media-word{position:absolute;right:9%;bottom:20%;font:600 10px/1 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.44em;color:rgba(235,242,244,.18)}
.wb-room.wb-field .wb-field-wash{position:absolute;z-index:1;inset:0;pointer-events:none;background:
  linear-gradient(90deg,rgba(5,8,10,.98) 0%,rgba(5,8,10,.94) 34%,rgba(5,8,10,.58) 60%,rgba(5,8,10,.12) 100%),
  linear-gradient(0deg,rgba(5,8,10,.98) 0%,rgba(5,8,10,.38) 25%,transparent 58%)}
.wb-room.wb-field .wb-field-hero.is-empty .wb-field-wash{background:linear-gradient(90deg,rgba(5,8,10,.97) 0%,rgba(5,8,10,.88) 42%,rgba(5,8,10,.42) 100%),linear-gradient(0deg,rgba(5,8,10,.98),transparent 60%)}
.wb-room.wb-field .wb-field-copy{position:relative;z-index:2;display:flex;flex-direction:column;justify-content:flex-end;min-height:342px;max-width:min(820px,72%);box-sizing:border-box;padding:54px 30px 92px;animation:wb-field-copy .58s .04s var(--wb-ease-out) both}
.wb-room.wb-field .wb-field-kicker{margin-bottom:15px;color:rgba(236,243,245,.58)}
.wb-room.wb-field .wb-field-kicker .wb-room-mark{width:34px;height:34px;border-radius:9px;font-size:11px;background:color-mix(in srgb,var(--wb-room-accent) 15%,rgba(8,12,14,.7));border-color:color-mix(in srgb,var(--wb-room-accent) 32%,rgba(255,255,255,.12));color:color-mix(in srgb,var(--wb-room-accent) 72%,#fff)}
.wb-room.wb-field .wb-field-index{margin-left:auto;font:500 8px/1 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.22em;color:rgba(236,243,245,.3);white-space:nowrap}
.wb-room.wb-field .wb-field-meta{position:absolute;z-index:3;right:30px;bottom:0;left:30px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid rgba(235,243,245,.13);background:linear-gradient(180deg,rgba(5,9,11,.2),rgba(5,9,11,.64));backdrop-filter:blur(12px)}
.wb-room.wb-field .wb-field-meta div{display:flex;flex-direction:column;gap:4px;min-width:0;padding:10px 16px 12px;border-left:1px solid rgba(235,243,245,.1)}
.wb-room.wb-field .wb-field-meta div:first-child{padding-left:0;border-left:0}
.wb-room.wb-field .wb-field-meta span{font-size:8px;letter-spacing:.13em;text-transform:uppercase;color:rgba(234,242,244,.42);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-room.wb-field .wb-field-meta b{font-size:11px;font-weight:540;letter-spacing:.01em;color:rgba(242,247,248,.78);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

.wb-room.wb-field .wb-room-chapters{top:61px;padding:0 30px;background:color-mix(in srgb,var(--dsw-alias-bg-base) 88%,transparent);border-bottom-color:var(--wb-field-line);scrollbar-width:none}
.wb-room.wb-field .wb-room-chapters::-webkit-scrollbar{display:none}
.wb-room.wb-field .wb-room-chapter{position:relative;gap:9px;padding:16px 24px 14px 0;margin-right:22px;border-bottom:1px solid transparent;font-size:12px;letter-spacing:.01em;color:rgba(231,239,241,.46);transition:color .2s ease}
.wb-room.wb-field .wb-room-chapter:after{content:"";position:absolute;left:0;bottom:-1px;width:0;height:1px;background:var(--wb-room-accent);transition:width .34s var(--wb-ease-out)}
.wb-room.wb-field .wb-room-chapter.on:after{width:100%}
.wb-room.wb-field .wb-room-chapter:first-child{padding-left:0}
.wb-room.wb-field .wb-room-chapter small{font:500 9px/1 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.1em;opacity:.62}
.wb-room.wb-field .wb-room-chapter:hover{color:rgba(242,247,248,.9)}
.wb-room.wb-field .wb-room-chapter.on{color:#f4f8f9}
.wb-room.wb-field .wb-room-chapter.on small{color:var(--wb-room-accent);opacity:1}
.wb-room.wb-field .wb-room-count{font-size:8px;padding:1px 5px;background:color-mix(in srgb,var(--wb-room-accent) 18%,transparent)}

.wb-room.wb-field .wb-ws-body{width:100%;max-width:1520px;margin:0 auto;box-sizing:border-box;padding:0 30px 64px}
.wb-room.wb-field .wb-ws-pane{padding:0;animation:wb-field-pane .3s var(--wb-ease-out)}
.wb-room.wb-field .wb-ws-pane.is-back{animation-name:wb-field-pane-back}
.wb-room.wb-field .wb-ws-pane:not(.is-overview){padding:30px 0 64px}
.wb-room.wb-field .wb-ws-pane-head{padding:0 0 20px;border-bottom:1px solid var(--wb-field-line);margin:0 0 22px}
.wb-room.wb-field .wb-ws-pane-head h2{font-size:clamp(30px,3.2vw,42px);line-height:1;font-weight:540;letter-spacing:-.055em;color:#f2f7f8}
.wb-room.wb-field .wb-ws-pane-head p{margin-top:8px;font-size:11px;color:rgba(232,241,243,.4)}
.wb-room.wb-field .wb-ws-pane-head .wb-btn{font-size:10px;padding:6px 11px}
.wb-room.wb-field .wb-ws-settings-card{border:0;border-top:1px solid var(--wb-field-line);border-radius:0;background:none;padding:22px 0 8px}
.wb-room.wb-field .wb-ws-settings-card:first-of-type{border-top:0;padding-top:0}
.wb-room.wb-field .wb-lineage-head{border:0;border-top:1px solid var(--wb-field-line);border-radius:0;background:none;padding:15px 0}
.wb-room.wb-field .wb-lineage-head .wb-chip{border-radius:999px}
.wb-room.wb-field .wb-ws-session-list.is-full{border-top:1px solid var(--wb-field-line);margin-top:4px}
.wb-room.wb-field .wb-ws-empty{border:0;border-top:1px dashed var(--wb-field-line);border-radius:0;background:none;margin-top:0;min-height:240px}
.wb-room.wb-field .wb-ws-outputs .wb-ws-empty{margin-top:22px}
.wb-room.wb-field .wb-field-grid{display:grid;grid-template-columns:minmax(0,1.58fr) minmax(290px,.7fr);gap:0;align-items:start}
.wb-room.wb-field .wb-field-main{min-width:0;padding:30px 42px 76px 0}
.wb-room.wb-field .wb-field-aside{display:flex;flex-direction:column;min-width:0;padding:30px 0 76px 30px;border-left:1px solid var(--wb-field-line)}
.wb-room.wb-field .wb-field-aside-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:0 0 13px;border-bottom:1px solid var(--wb-field-line)}
.wb-room.wb-field .wb-field-aside-head span{font:500 8px/1 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.2em;color:rgba(232,241,243,.34)}
.wb-room.wb-field .wb-field-aside-head b{font-size:10px;font-weight:500;letter-spacing:.08em;color:rgba(232,241,243,.56)}
.wb-room.wb-field .wb-field-next{position:relative;border:0;border-radius:0;background:none;padding:0 0 30px;margin:0}
.wb-room.wb-field .wb-field-next:before{content:"";position:absolute;left:-18px;top:2px;bottom:32px;width:1px;background:linear-gradient(180deg,var(--wb-room-accent),color-mix(in srgb,var(--wb-room-accent) 8%,transparent));opacity:.72;transition:opacity .25s ease,width .25s ease}
.wb-room.wb-field .wb-field-next:hover:before{width:2px;opacity:1}
.wb-room.wb-field .wb-room-command-head{gap:11px}
.wb-room.wb-field .wb-room-command-head span{font-size:8px;letter-spacing:.2em;color:rgba(232,241,243,.38)}
.wb-room.wb-field .wb-room-command-head b{font-size:clamp(28px,2.7vw,40px);font-weight:540;letter-spacing:-.055em;line-height:1.02;color:#f1f7f8}
.wb-room.wb-field .wb-room-task{align-items:flex-end;gap:20px;border-top:1px solid var(--wb-field-line);padding:20px 0 0;margin-top:24px}
.wb-room.wb-field .wb-room-task-copy{gap:5px}
.wb-room.wb-field .wb-room-task-copy strong{font-size:14px;font-weight:560;letter-spacing:-.01em}
.wb-room.wb-field .wb-room-task-copy p{max-width:520px;font-size:10px;line-height:1.6;color:rgba(232,241,243,.42);white-space:normal}
.wb-room.wb-field .wb-room-task-actions{gap:8px}
.wb-room.wb-field .wb-room-compose-toggle{width:auto;justify-content:flex-start;margin-top:16px;padding:0;border:0;background:none;color:rgba(232,241,243,.46);font-size:10px;letter-spacing:.02em}
.wb-room.wb-field .wb-room-compose-toggle:hover{color:rgba(245,250,251,.9)}
.wb-room.wb-field .wb-room-compose-toggle.is-open{color:var(--wb-room-accent)}
.wb-room.wb-field .wb-room-command-row{gap:12px;margin-top:16px;padding-top:14px;border-top:1px solid var(--wb-field-line);animation:wb-field-reveal .28s var(--wb-ease-out) both}
.wb-room.wb-field .wb-room-command-row textarea{min-height:64px;border:0;border-bottom:1px solid rgba(235,243,245,.2);border-radius:0;background:transparent;padding:8px 0 10px;font-size:15px;line-height:1.55;resize:vertical}
.wb-room.wb-field .wb-room-command-row textarea:focus{border-bottom-color:var(--wb-room-accent);outline:none}
.wb-room.wb-field .wb-room-command-hint{font-size:9px;color:rgba(232,241,243,.34)}
.wb-room.wb-field .wb-field-main .wb-ws-section{border:0;border-top:1px solid var(--wb-field-line);border-radius:0;background:none;padding:24px 0 6px}
.wb-room.wb-field .wb-field-main .wb-ws-section:first-child{border-top:0;padding-top:0}
.wb-room.wb-field .wb-ws-section-head{margin-bottom:14px}
.wb-room.wb-field .wb-ws-section-head h2{font-size:10px;letter-spacing:.17em;color:rgba(232,241,243,.58)}
.wb-room.wb-field .wb-ws-section-head>span{font-size:9px;color:rgba(232,241,243,.3)}
.wb-room.wb-field .wb-ws-section-head .wb-link{font-size:9px;color:rgba(232,241,243,.46)}
.wb-room.wb-field .wb-ws-session{padding:12px 0;border:0;border-top:1px solid var(--wb-field-line);border-radius:0;background:none}
.wb-room.wb-field .wb-ws-session:first-child{border-top:0}
.wb-room.wb-field .wb-ws-session-title{font-size:12px;font-weight:520}
.wb-room.wb-field .wb-ws-session-meta{color:rgba(232,241,243,.38)}
.wb-room.wb-field .wb-ws-session-actions .wb-btn{font-size:9px;padding:4px 7px}
.wb-room.wb-field .wb-ws-note{min-height:0;max-height:128px;border:0;border-bottom:1px solid rgba(235,243,245,.18);border-radius:0;background:transparent;padding:8px 0;font-size:12px;line-height:1.7;resize:vertical}
.wb-room.wb-field .wb-ws-note:focus{border-bottom-color:var(--wb-room-accent);outline:none}
.wb-room.wb-field .wb-field-note{border-top:1px solid var(--wb-field-line);padding:0}
.wb-room.wb-field .wb-field-note summary{display:flex;align-items:center;gap:8px;padding:24px 0 7px;cursor:pointer;list-style:none;color:rgba(232,241,243,.62);font-size:10px;letter-spacing:.13em;text-transform:uppercase}
.wb-room.wb-field .wb-field-note summary::-webkit-details-marker{display:none}
.wb-room.wb-field .wb-field-note summary:after{content:"+";margin-left:auto;font:400 15px/1 ui-monospace,SFMono-Regular,Consolas,monospace;color:rgba(232,241,243,.36)}
.wb-room.wb-field .wb-field-note[open] summary:after{content:"−"}
.wb-room.wb-field .wb-field-note-title{display:flex;align-items:center;gap:7px}
.wb-room.wb-field .wb-field-note-hint{margin-left:10px;font-size:9px;letter-spacing:0;text-transform:none;color:rgba(232,241,243,.3)}
.wb-room.wb-field .wb-field-note-body{padding:2px 0 12px}
.wb-room.wb-field .wb-ws-note-foot{padding-top:9px}

.wb-room.wb-field .wb-field-aside .wb-ws-side-card{border:0;border-top:1px solid var(--wb-field-line);border-radius:0;background:none;padding:16px 0 0;margin:0}
.wb-room.wb-field .wb-field-aside .wb-ws-side-card:first-of-type{border-top:0;padding-top:14px}
.wb-room.wb-field .wb-field-aside .wb-room-details{order:1}
.wb-room.wb-field .wb-field-aside .wb-room-memory{order:2}
.wb-room.wb-field .wb-field-aside .wb-room-contract{order:3}
.wb-room.wb-field .wb-field-aside .wb-room-relations{order:4}
.wb-room.wb-field .wb-field-aside .wb-room-tags{order:5}
.wb-room.wb-field .wb-field-aside .wb-ws-side-title{padding:0 0 11px;font-size:9px;letter-spacing:.16em;color:rgba(232,241,243,.52)}
.wb-room.wb-field .wb-field-aside .wb-room-details .wb-ws-side-title{display:none}
.wb-room.wb-field .wb-field-aside .wb-ws-side-title .wb-chip{font-size:8px;padding:1px 5px;background:transparent}
.wb-room.wb-field .wb-field-aside .wb-ws-facts{grid-template-columns:1fr;gap:0}
.wb-room.wb-field .wb-field-aside .wb-ws-facts>div{display:flex;align-items:baseline;justify-content:space-between;gap:14px;padding:7px 0;border-bottom:1px solid color-mix(in srgb,var(--wb-field-line) 62%,transparent)}
.wb-room.wb-field .wb-field-aside .wb-ws-facts>div:last-child{border-bottom:0}
.wb-room.wb-field .wb-field-aside .wb-ws-facts span{font-size:9px;letter-spacing:.02em;color:rgba(232,241,243,.36)}
.wb-room.wb-field .wb-field-aside .wb-ws-facts b{font-size:10px;font-weight:500;text-align:right;color:rgba(238,245,246,.72);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:68%}
.wb-room.wb-field .wb-field-aside .wb-room-memory{gap:8px}
.wb-room.wb-field .wb-field-aside .wb-room-memory-row{font-size:10px;color:rgba(232,241,243,.46)}
.wb-room.wb-field .wb-field-aside .wb-room-memory-path{font-size:8px;color:rgba(232,241,243,.28)}
.wb-room.wb-field .wb-field-aside .wb-room-memory-empty{font-size:10px;line-height:1.6;color:rgba(232,241,243,.38)}
.wb-room.wb-field .wb-field-aside .wb-room-contract summary{cursor:pointer}
.wb-room.wb-field .wb-field-aside .wb-contract-body{padding-top:6px}
.wb-room.wb-field .wb-field-aside .wb-contract-row{display:flex;flex-direction:column;gap:3px;padding:7px 0;border-bottom:1px solid color-mix(in srgb,var(--wb-field-line) 62%,transparent)}
.wb-room.wb-field .wb-field-aside .wb-contract-row:last-of-type{border-bottom:0}
.wb-room.wb-field .wb-field-aside .wb-contract-row b{font-size:8px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:rgba(232,241,243,.3)}
.wb-room.wb-field .wb-field-aside .wb-contract-row span{font-size:10px;line-height:1.6;color:rgba(238,245,246,.66)}
.wb-room.wb-field .wb-field-aside .wb-contract-hint{font-size:8px;line-height:1.6;color:rgba(232,241,243,.26)}
.wb-room.wb-field .wb-field-aside .wb-room-relations,.wb-room.wb-field .wb-field-aside .wb-room-tags{font-size:10px}
.wb-room.wb-field .wb-field-aside .wb-tag-list{gap:5px}
.wb-room.wb-field .wb-field-aside .wb-tag-list .wb-chip{font-size:8px;padding:2px 6px}

@keyframes wb-field-enter{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:none}}
@keyframes wb-field-copy{from{opacity:0;transform:translateY(13px)}to{opacity:1;transform:none}}
@keyframes wb-field-cover{from{opacity:0;transform:scale(1.07)}to{opacity:1;transform:scale(1.035)}}
@keyframes wb-field-pane{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes wb-field-pane-back{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
@keyframes wb-field-reveal{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:none}}

@media (max-width:1240px){
  .wb-room.wb-field .wb-field-grid{grid-template-columns:minmax(0,1.45fr) minmax(270px,.68fr)}
  .wb-room.wb-field .wb-field-main{padding-right:30px}
  .wb-room.wb-field .wb-field-aside{padding-left:24px}
  .wb-room.wb-field .wb-room-title{font-size:clamp(40px,4.8vw,62px)}
}
@media (max-width:980px){
  .wb-room.wb-field .wb-field-copy{max-width:72%;padding-left:24px;padding-right:24px}
  .wb-room.wb-field .wb-field-meta{left:24px;right:24px}
  .wb-room.wb-field .wb-ws-body{padding:0 24px 56px}
  .wb-room.wb-field .wb-room-chapters{padding:0 24px}
  .wb-room.wb-field .wb-field-grid{grid-template-columns:minmax(0,1.35fr) minmax(250px,.65fr)}
  .wb-room.wb-field .wb-field-main{padding-right:24px}
  .wb-room.wb-field .wb-field-aside{padding-left:20px}
}
@media (max-width:840px){
  .wb-room.wb-field .wb-field-hero{min-height:322px}
  .wb-room.wb-field .wb-field-media{width:100%;opacity:.46;border-left:0}
  .wb-room.wb-field .wb-field-media.is-empty{width:100%;opacity:.5}
  .wb-room.wb-field .wb-field-wash{background:linear-gradient(90deg,rgba(5,8,10,.98) 0%,rgba(5,8,10,.86) 56%,rgba(5,8,10,.56) 100%),linear-gradient(0deg,rgba(5,8,10,.98),transparent 65%)}
  .wb-room.wb-field .wb-field-copy{max-width:100%;min-height:322px;padding:38px 24px 112px}
  .wb-room.wb-field .wb-room-title{font-size:clamp(36px,6.4vw,54px)}
  .wb-room.wb-field .wb-field-meta{grid-template-columns:repeat(2,minmax(0,1fr));left:24px;right:24px}
  .wb-room.wb-field .wb-field-meta div:nth-child(3){border-left:0;padding-left:0}
  .wb-room.wb-field .wb-field-grid{grid-template-columns:1fr}
  .wb-room.wb-field .wb-ws-pane:not(.is-overview){padding:24px 0 48px}
  .wb-room.wb-field .wb-field-main{padding:26px 0 42px}
  .wb-room.wb-field .wb-field-aside{padding:24px 0 48px;border-left:0;border-top:1px solid var(--wb-field-line);display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 24px}
  .wb-room.wb-field .wb-field-aside-head{grid-column:1/-1}
  .wb-room.wb-field .wb-field-aside .wb-ws-side-card{padding-top:14px}
}
@media (max-width:680px){
  .wb-room.wb-field .wb-room-top{padding:9px 16px;gap:8px}
  .wb-room.wb-field .wb-room-crumb,.wb-room.wb-field .wb-room-wheel-hint{display:none}
  .wb-room.wb-field .wb-room-back{padding:6px 9px;font-size:11px}
  .wb-room.wb-field .wb-room-top-actions{width:auto;margin-left:auto;flex:0 0 auto;gap:5px}
  .wb-room.wb-field .wb-room-top-actions .wb-btn{font-size:10px;padding:0 9px;min-height:32px}
  .wb-room.wb-field .wb-field-hero{min-height:306px}
  .wb-room.wb-field .wb-field-copy{min-height:306px;padding:30px 18px 126px}
  .wb-room.wb-field .wb-room-title{font-size:clamp(34px,9.2vw,44px);letter-spacing:-.06em}
  .wb-room.wb-field .wb-field-kicker{margin-bottom:12px;gap:7px;font-size:8px}
  .wb-room.wb-field .wb-field-index{display:none}
  .wb-room.wb-field .wb-room-path{margin-top:11px;font-size:9px;max-width:100%}
  .wb-room.wb-field .wb-room-chips{margin-top:13px;gap:4px}
  .wb-room.wb-field .wb-room-chips .wb-chip{font-size:8px;padding:2px 6px}
  .wb-room.wb-field .wb-field-meta{left:18px;right:18px}
  .wb-room.wb-field .wb-field-meta div{padding:8px 10px 9px}
  .wb-room.wb-field .wb-field-meta div:nth-child(odd){padding-left:0}
  .wb-room.wb-field .wb-field-meta span{font-size:7px}
  .wb-room.wb-field .wb-field-meta b{font-size:10px}
  .wb-room.wb-field .wb-field-media-caption{right:18px;left:18px;bottom:82px;font-size:8px}
  .wb-room.wb-field .wb-room-chapters{padding:0 18px;top:51px}
  .wb-room.wb-field .wb-room-chapter{padding:14px 18px 12px 0;margin-right:13px;font-size:11px}
  .wb-room.wb-field .wb-ws-body{padding:0 18px 48px}
  .wb-room.wb-field .wb-ws-pane:not(.is-overview){padding:22px 0 40px}
  .wb-room.wb-field .wb-field-main{padding:24px 0 38px}
  .wb-room.wb-field .wb-field-next:before{left:-10px}
  .wb-room.wb-field .wb-room-command-head b{font-size:30px}
  .wb-room.wb-field .wb-room-task{align-items:flex-start;flex-direction:column;gap:14px;margin-top:18px;padding-top:16px}
  .wb-room.wb-field .wb-room-task-actions{width:100%}
  .wb-room.wb-field .wb-room-task-actions .wb-btn{flex:1}
  .wb-room.wb-field .wb-room-command-row{flex-direction:column;align-items:stretch}
  .wb-room.wb-field .wb-room-command-row .wb-btn{align-self:flex-start}
  .wb-room.wb-field .wb-field-aside{display:flex;padding-top:22px}
  .wb-room.wb-field .wb-field-aside-head{padding-bottom:10px}
  .wb-room.wb-field .wb-field-note summary{padding-top:20px}
}
@media (max-width:460px){.wb-room.wb-field .wb-room-open span{display:none}.wb-room.wb-field .wb-room-open{padding:0 8px}}
@media (prefers-reduced-motion:reduce){.wb-room.wb-field,.wb-room.wb-field .wb-field-copy,.wb-room.wb-field .wb-field-media img,.wb-room.wb-field .wb-ws-pane{animation:none!important}}

/* A quiet visual trace of the scene the user is returning to. */
.wb-room.wb-field.is-origin-earth{--wb-origin-color:#93c8d1}
.wb-room.wb-field.is-origin-studio{--wb-origin-color:#a9c8ac}
.wb-room.wb-field.is-origin-library{--wb-origin-color:#dbc199}
.wb-room.wb-field .wb-field-origin{position:absolute;z-index:2;right:3%;top:7%;width:clamp(130px,20vw,240px);height:auto;color:var(--wb-origin-color);pointer-events:none;opacity:.62;animation:wbOriginArrive .65s var(--wb-ease-out) both}
.wb-room.wb-field .wb-field-hero:not(.is-empty) .wb-field-origin{opacity:.38}
.wb-room.wb-field .wb-field-origin line,.wb-room.wb-field .wb-field-origin path,.wb-room.wb-field .wb-field-origin rect,.wb-room.wb-field .wb-field-origin circle,.wb-room.wb-field .wb-field-origin ellipse{vector-effect:non-scaling-stroke}
.wb-room.wb-field .wb-field-index.is-origin{color:var(--wb-origin-color);opacity:.9}
@keyframes wbOriginArrive{from{opacity:0;transform:scale(1.08)}to{transform:scale(1)}}
@media(max-width:760px){.wb-room.wb-field .wb-field-origin{width:130px;right:3%;top:5%;opacity:.3}}
@media(prefers-reduced-motion:reduce){.wb-room.wb-field .wb-field-origin{animation:none!important}}
/* Project workspace on touch screens: keep content in the viewport and inputs legible. */
@media (max-width:680px){
  .wb-room.wb-field{min-width:0}
  .wb-room.wb-field .wb-room-top{position:sticky;top:0;padding:8px 12px;gap:6px}
  .wb-room.wb-field .wb-room-back,.wb-room.wb-field .wb-room-top-actions .wb-btn{min-height:44px;font-size:12px}
  .wb-room.wb-field .wb-room-top-actions .wb-room-open{min-width:44px}
  .wb-room.wb-field .wb-field-hero{min-height:0}
  .wb-room.wb-field .wb-field-copy{min-height:210px;padding:26px 16px 20px}
  .wb-room.wb-field .wb-room-title{overflow-wrap:anywhere;word-break:break-word}
  .wb-room.wb-field .wb-room-path{display:-webkit-box;max-width:100%;overflow:hidden;white-space:normal;overflow-wrap:anywhere;font-size:11px;line-height:1.4;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  .wb-room.wb-field .wb-room-chips .wb-chip{font-size:11px;padding:3px 7px}
  .wb-room.wb-field .wb-field-meta{position:relative;left:auto;right:auto;bottom:auto;margin:0 16px}
  .wb-room.wb-field .wb-field-meta div{min-width:0}
  .wb-room.wb-field .wb-field-meta span{font-size:10px;letter-spacing:.05em}
  .wb-room.wb-field .wb-field-meta b{font-size:12px}
  .wb-room.wb-field .wb-room-chapters{top:61px;max-width:100%;overflow-x:auto;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch}
  .wb-room.wb-field .wb-room-chapter{flex:0 0 auto;min-height:44px;padding:11px 14px 10px 0;margin-right:10px;font-size:13px}
  .wb-room.wb-field .wb-ws-body{min-width:0;padding-left:16px;padding-right:16px}
  .wb-room.wb-field .wb-ws-pane,.wb-room.wb-field .wb-ws-settings,.wb-room.wb-field .wb-ws-settings-card{min-width:0}
  .wb-room.wb-field .wb-ws-pane-head{align-items:flex-start;flex-wrap:wrap}
  .wb-room.wb-field .wb-room-task-copy p{font-size:12px}
  .wb-room.wb-field .wb-field-aside .wb-ws-facts span{font-size:11px}
  .wb-room.wb-field .wb-field-aside .wb-ws-facts b{font-size:12px}
  .wb-room.wb-field .wb-ws-session{flex-wrap:wrap}
  .wb-room.wb-field .wb-ws-session-main{flex-basis:calc(100% - 24px)}
  .wb-room.wb-field .wb-ws-session-actions{max-width:100%;margin-left:15px;flex-wrap:wrap}
  .wb-room.wb-field .wb-ws-body input,.wb-room.wb-field .wb-ws-body textarea,.wb-room.wb-field .wb-ws-body select{max-width:100%;font-size:16px}
  .wb-room.wb-field .wb-ws-body .wb-btn,.wb-room.wb-field .wb-life-choice,.wb-room.wb-field .wb-status-btn{min-height:44px}
  .wb-room.wb-field .wb-ws-footer-info span,.wb-room.wb-field .wb-life-settings-foot code{white-space:normal;overflow-wrap:anywhere}
}
@media (max-width:900px) and (max-height:520px) and (orientation:landscape){
  .wb-room.wb-field .wb-field-hero{min-height:0}
  .wb-room.wb-field .wb-field-copy{min-height:150px;padding:20px 20px 12px}
  .wb-room.wb-field .wb-field-meta{position:relative;left:auto;right:auto;bottom:auto;margin:0 20px;grid-template-columns:repeat(4,minmax(0,1fr))}
  .wb-room.wb-field .wb-field-meta div:nth-child(3){border-left:1px solid rgba(235,243,245,.1);padding-left:10px}
  .wb-room.wb-field .wb-ws-body input,.wb-room.wb-field .wb-ws-body textarea,.wb-room.wb-field .wb-ws-body select{font-size:16px}
}
/* A desktop host can also embed the workspace in a phone-width panel. */
@container wb-workbench (max-width:600px){
  .wb-room.wb-field{min-width:0}
  .wb-room.wb-field .wb-room-top{position:sticky;top:0;flex-wrap:nowrap;padding:8px 12px;gap:6px}
  .wb-room.wb-field .wb-room-crumb,.wb-room.wb-field .wb-room-wheel-hint{display:none}
  .wb-room.wb-field .wb-room-back,.wb-room.wb-field .wb-room-top-actions .wb-btn{min-height:44px;font-size:12px}
  .wb-room.wb-field .wb-room-top-actions{width:auto;margin-left:auto;flex:0 0 auto;gap:5px}
  .wb-room.wb-field .wb-room-top-actions .wb-room-open{min-width:44px;padding:0 8px}
  .wb-room.wb-field .wb-room-open span{display:none}
  .wb-room.wb-field .wb-field-hero{min-height:0}
  .wb-room.wb-field .wb-field-media,.wb-room.wb-field .wb-field-media.is-empty{width:100%;opacity:.46;border-left:0}
  .wb-room.wb-field .wb-field-copy{max-width:100%;min-height:210px;padding:26px 16px 20px}
  .wb-room.wb-field .wb-room-title{font-size:clamp(30px,9cqw,44px);overflow-wrap:anywhere;word-break:break-word}
  .wb-room.wb-field .wb-room-path{display:-webkit-box;max-width:100%;overflow:hidden;white-space:normal;overflow-wrap:anywhere;font-size:11px;line-height:1.4;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  .wb-room.wb-field .wb-room-chips{gap:4px;margin-top:13px}.wb-room.wb-field .wb-room-chips .wb-chip{font-size:11px;padding:3px 7px}
  .wb-room.wb-field .wb-field-meta{position:relative;left:auto;right:auto;bottom:auto;margin:0 16px;grid-template-columns:repeat(2,minmax(0,1fr))}
  .wb-room.wb-field .wb-field-meta div{min-width:0;padding:8px 10px 9px}.wb-room.wb-field .wb-field-meta div:nth-child(odd){border-left:0;padding-left:0}
  .wb-room.wb-field .wb-field-meta span{font-size:10px;letter-spacing:.05em}.wb-room.wb-field .wb-field-meta b{font-size:12px}
  .wb-room.wb-field .wb-room-chapters{top:61px;max-width:100%;padding:0 18px;overflow-x:auto;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch}
  .wb-room.wb-field .wb-room-chapter{flex:0 0 auto;min-height:44px;padding:11px 14px 10px 0;margin-right:10px;font-size:13px}
  .wb-room.wb-field .wb-ws-body{min-width:0;padding:0 16px 48px}
  .wb-room.wb-field .wb-ws-pane,.wb-room.wb-field .wb-ws-settings,.wb-room.wb-field .wb-ws-settings-card{min-width:0}
  .wb-room.wb-field .wb-ws-pane.is-overview .wb-ws-overview-grid,.wb-room.wb-field .wb-ws-settings{grid-template-columns:minmax(0,1fr)}
  .wb-room.wb-field .wb-field-main{padding:24px 0 38px}.wb-room.wb-field .wb-field-aside{display:flex;padding:22px 0 48px;border-left:0;border-top:1px solid var(--wb-field-line)}
  .wb-room.wb-field .wb-room-task{align-items:flex-start;flex-direction:column;gap:14px}.wb-room.wb-field .wb-room-task-actions{width:100%}
  .wb-room.wb-field .wb-room-task-actions .wb-btn{flex:1}.wb-room.wb-field .wb-room-task-copy p{font-size:12px}
  .wb-room.wb-field .wb-room-command-row{flex-direction:column;align-items:stretch}
  .wb-room.wb-field .wb-ws-pane-head{align-items:flex-start;flex-wrap:wrap}.wb-room.wb-field .wb-ws-session{flex-wrap:wrap}
  .wb-room.wb-field .wb-ws-session-main{flex-basis:calc(100% - 24px)}.wb-room.wb-field .wb-ws-session-actions{max-width:100%;margin-left:15px;flex-wrap:wrap}
  .wb-room.wb-field .wb-ws-body input,.wb-room.wb-field .wb-ws-body textarea,.wb-room.wb-field .wb-ws-body select{max-width:100%;font-size:16px}
  .wb-room.wb-field .wb-ws-body .wb-btn,.wb-room.wb-field .wb-life-choice,.wb-room.wb-field .wb-status-btn{min-height:44px}
  .wb-room.wb-field .wb-field-aside .wb-ws-facts span{font-size:11px}.wb-room.wb-field .wb-field-aside .wb-ws-facts b{font-size:12px}
  .wb-room.wb-field .wb-ws-footer{flex-wrap:wrap;padding:12px 14px}.wb-room.wb-field .wb-ws-footer-info{width:100%}
  .wb-room.wb-field .wb-ws-footer-info span,.wb-room.wb-field .wb-life-settings-foot code{white-space:normal;overflow-wrap:anywhere}
}

.wb-earth-hint-touch,.wb-earth-bottom .wb-earth-hint-touch,.wb-studio-mobile-nav,.wb-studio-mobile-pan{display:none}
/* Scene-specific touch layout: keep the map usable and the project index legible. */
@media (max-width:760px){
  .wb-earth-hint-desktop,.wb-earth-bottom .wb-earth-hint-desktop{display:none}
  .wb-earth-hint-touch,.wb-earth-bottom .wb-earth-hint-touch{display:inline}
  .wb-earth-top{left:10px;right:10px;top:10px;gap:4px}
  .wb-earth-brand{gap:5px}.wb-earth-brand>span:nth-child(2){font-size:11px}
  .wb-earth-control{min-height:40px;font-size:11px;padding:5px 8px}
  .wb-earth-zoombar button{width:44px;height:44px}
  .wb-earth-close,.wb-earth-card-close{min-width:40px;min-height:40px}
  .wb-earth-search,.wb-studio-search input,.wb-llib-search input{font-size:16px}
  .wb-earth-index-list{grid-template-columns:minmax(0,1fr)}
  .wb-earth-project-card{min-height:64px;padding:8px 10px}
  .wb-earth-index.is-deck{left:8px;right:8px;bottom:8px;max-height:min(44%,280px)}
  .wb-earth.is-landing .wb-earth-inspector.is-map-card{left:8px!important;right:8px!important;bottom:8px!important;max-height:min(58%,340px)!important}
  .wb-earth.is-landing .wb-earth-inspector .wb-anchor-record,.wb-earth.is-landing .wb-earth-inspector .wb-earth-note{margin-left:0}
  .wb-earth-card-actions .wb-btn{min-height:44px}
  .wb-studio-viewport{overflow:auto;touch-action:pan-x pan-y;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
  .wb-studio:not(.is-room) .wb-studio-stage-wrap{height:auto;min-height:0;aspect-ratio:1040/600}
  .wb-studio-plan.wb-atelier-plan{position:relative;left:auto;top:auto;inset:auto;width:100%;height:auto;aspect-ratio:1040/600;margin:0;transform:none!important}
  .wb-studio.is-room .wb-studio-plan.wb-atelier-plan{width:720px;height:416px;aspect-ratio:auto}
  .wb-atelier-roombar{position:sticky;left:0;top:0;width:calc(100vw - 36px);width:min(100%,calc(100cqw - 36px));max-width:100%;box-sizing:border-box;flex-wrap:wrap}
  .wb-atelier-back,.wb-atelier-tabs button,.wb-scene-details-toggle{min-height:40px;font-size:11px}
  .wb-atelier-tabs{max-width:100%}
  .wb-studio-mobile-nav{display:flex;gap:6px;overflow-x:auto;max-width:100%;padding:2px 0 6px;-webkit-overflow-scrolling:touch}
  .wb-studio-mobile-nav button{flex:none;min-height:44px;max-width:200px;padding:6px 12px;border:1px solid rgba(201,224,203,.35);border-radius:8px;background:rgba(37,56,47,.5);color:#f2f8ef;font:inherit;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .wb-studio-mobile-pan{display:block;margin:0;color:rgba(226,238,229,.72);font-size:12px;line-height:1.4}
  .wb-llib-svg{min-width:0;width:100%;height:auto}
  .wb-llib-stage{overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
  .wb-llib-tab,.wb-llib-project-index button{min-height:40px;font-size:12px}
  .wb-llib-project-index{max-width:100%;-webkit-overflow-scrolling:touch}
  .wb-llib-stage-wrap{height:auto;min-height:0;max-height:none}
}
/* Also fit a narrow embedded workbench inside a wide desktop browser. */
@container wb-workbench (max-width:600px){
  .wb-earth-top{left:10px;right:10px;top:10px;gap:4px}
  .wb-earth-brand{gap:5px}.wb-earth-brand>span:nth-child(2){font-size:11px}
  .wb-earth-clock,.wb-earth-caption,.wb-earth-intro,.wb-earth-focus-hint,.wb-earth-index-hint{display:none}
  .wb-earth-control{min-height:40px;font-size:11px;padding:5px 8px}
  .wb-earth-zoombar{right:10px;bottom:48px}.wb-earth-zoombar button{width:44px;height:44px}
  .wb-earth-close,.wb-earth-card-close{min-width:40px;min-height:40px}
  .wb-earth-search,.wb-studio-search input,.wb-llib-search input{font-size:16px}
  .wb-earth-index.is-deck{left:8px;right:8px;top:auto;bottom:8px;width:auto;max-height:min(44%,280px);padding:11px 12px 9px}
  .wb-earth-index-list{grid-template-columns:minmax(0,1fr)}.wb-earth-project-card{min-height:64px;padding:8px 10px}
  .wb-earth-inspector,.wb-earth.is-landing .wb-earth-inspector.is-map-card{left:8px!important;right:8px!important;top:auto!important;bottom:8px!important;width:auto!important;max-height:min(58%,340px)!important;border-radius:16px;padding:12px 16px 10px;overflow:auto}
  .wb-earth.is-landing .wb-earth-inspector.is-map-card .wb-earth-card-tail{display:none!important}
  .wb-earth.is-landing .wb-earth-inspector .wb-anchor-record,.wb-earth.is-landing .wb-earth-inspector .wb-earth-note{margin-left:0}
  .wb-earth-card-actions .wb-btn{min-height:44px}
  .wb-studio{height:auto;min-height:0;overflow:auto}.wb-studio-top{position:relative;flex-direction:column;gap:8px;padding:10px 0 8px;background:none;pointer-events:auto}
  .wb-studio-top p{white-space:normal}.wb-studio-search{flex:1 1 auto;width:100%;min-width:0}
  .wb-studio-body{position:relative;inset:auto;display:grid;grid-template-columns:minmax(0,1fr);gap:10px}
  .wb-studio-stage-wrap{height:400px;min-height:0}.wb-studio:not(.is-room) .wb-studio-stage-wrap{height:auto;min-height:0;aspect-ratio:1040/600}
  .wb-studio-stagebar{top:8px;left:12px;right:12px;flex-wrap:wrap;gap:6px}.wb-studio-stage-count,.wb-studio-zoom{display:none}
  .wb-studio.is-room .wb-studio-top,.wb-studio.is-room .wb-studio-stagebar{display:none}
  .wb-studio-inspector,.wb-studio.is-room .wb-studio-inspector{height:auto;max-height:none;padding:12px 0 0;border-left:0;border-top:1px solid rgba(184,206,188,.14);overflow:visible;background:none}
  .wb-studio-viewport{overflow:auto;touch-action:pan-x pan-y;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
  .wb-studio-plan.wb-atelier-plan,.wb-studio.is-room .wb-studio-plan.wb-atelier-plan{position:relative;left:auto;top:auto;inset:auto;width:100%;height:auto;aspect-ratio:1040/600;margin:0;transform:none!important}
  .wb-studio.is-room .wb-studio-plan.wb-atelier-plan{width:720px;height:416px;aspect-ratio:auto}
  .wb-atelier-scene{padding:0}.wb-atelier-legendbar{display:none}
  .wb-atelier-roombar{position:sticky;left:0;right:auto;top:0;width:min(100%,calc(100cqw - 36px));max-width:100%;box-sizing:border-box;flex-wrap:wrap}
  .wb-atelier-roombar-title small{display:none}.wb-atelier-back,.wb-atelier-tabs button,.wb-scene-details-toggle{min-height:40px;font-size:11px}.wb-atelier-tabs{max-width:100%}
  .wb-studio-mobile-nav{display:flex;gap:6px;overflow-x:auto;max-width:100%;padding:2px 0 6px;-webkit-overflow-scrolling:touch}
  .wb-studio-mobile-nav button{flex:none;min-height:44px;max-width:200px;padding:6px 12px;border:1px solid rgba(201,224,203,.35);border-radius:8px;background:rgba(37,56,47,.5);color:#f2f8ef;font:inherit;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .wb-studio-mobile-pan{display:block;margin:0;color:rgba(226,238,229,.72);font-size:12px;line-height:1.4}
  .wb-llib-top{height:auto;flex-wrap:wrap;padding:10px 10px 0;gap:8px}.wb-llib-head-actions{width:100%;padding-top:0}.wb-llib-search{flex:1 1 auto;width:auto}
  .wb-llib-body{position:relative;inset:auto;display:flex;flex-direction:column}.wb-llib-stage-wrap{height:auto;min-height:0;max-height:none;flex:none;padding:0 4px 8px}
  .wb-llib-stagebar{height:auto;min-height:38px;flex-wrap:wrap;padding:5px 0;gap:6px}.wb-llib-crumb{width:100%}.wb-llib-crumb span{display:none}.wb-llib-tabs{order:3;width:100%}
  .wb-llib-stage{overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}.wb-llib-svg{min-width:0;width:100%;height:auto}
  .wb-llib-tab,.wb-llib-project-index button{min-height:40px;font-size:12px}.wb-llib-project-index{max-width:100%;-webkit-overflow-scrolling:touch}
  .wb-llib-inspector{border-left:0;border-top:1px solid rgba(208,183,145,.14);padding:14px}
}

`

    function StatusPill({ status, tr }) {
      const color = statusColor(status)
      return h('span', { className: 'wb-status-pill', style: { '--pill-color': color } },
        h('span', { className: 'wb-dot' }), statusLabel(status, tr))
    }

    function Panel({ title, sub, action, children, className = '' }) {
      return h('section', { className: cx('wb-panel', className) },
        h('div', { className: 'wb-panel-head' },
          h('div', null,
            h('div', { className: 'wb-panel-title' }, title),
            sub ? h('div', { className: 'wb-panel-sub' }, sub) : null),
          action || null),
        h('div', { className: 'wb-panel-body' }, children))
    }

    function RowProject({ p, index, tr, onSelect }) {
      return h('div', { className: 'wb-row', 'data-project-id': p.id, onClick: () => onSelect(p), role: 'button', tabIndex: 0, onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(p) } },
        h('div', { className: 'wb-rank' }, String(index + 1).padStart(2, '0')),
        h('div', { className: 'wb-row-main' },
          h('div', { className: 'wb-row-name', 'data-wb-morph-title': '1' }, p.displayName || p.name),
          h('div', { className: 'wb-row-meta' }, `${p.workspace || (p.kind && p.kind !== 'project' ? p.kind : tr('projectLabel'))} · ${p.note ? truncate(p.note, 42) : (p.summary ? truncate(p.summary, 42) : tr('noSummary'))}`)),
        h('div', { className: 'wb-row-right' },
          h('div', null, fmtBytes(p.sizeBytes)),
          h('div', { style: { marginTop: '3px' } }, relTime(p.lastActivity, tr))))
    }

    const SOURCE_LABEL_KEYS = {
      auto: 'sourceAuto',
      manifest: 'sourceManifest',
      runtime: 'sourceRuntime',
      manual: 'sourceManual',
      convention: 'sourceConvention',
    }
    const statusSourceLabel = (source, tr) => source
      ? tr(SOURCE_LABEL_KEYS[source] || 'sourceOther', { value: source })
      : tr('sourceUnknown')

    const RUNTIME_STATE_KEYS = {
      ready: 'runtimeReady',
      running: 'runtimeRunning',
      waiting: 'runtimeWaiting',
      blocked: 'runtimeBlocked',
      failed: 'runtimeFailed',
      done: 'runtimeDone',
      unknown: 'runtimeUnknown',
    }

    function RuntimeStateBadge({ runtime, tr }) {
      if (!runtime) return null
      const label = tr(RUNTIME_STATE_KEYS[runtime.state] || 'runtimeUnknown')
      return h('span', {
        className: cx('wb-rt-state', `is-${runtime.state}`, runtime.stale && 'is-stale'),
        title: runtime.stale ? tr('runtimeStale') : label,
      }, h('i', { className: 'wb-rt-state-dot' }), label,
        runtime.stale ? h('span', { className: 'wb-rt-state-stale' }, `· ${tr('runtimeStale')}`) : null)
    }

    function runtimeStages(runtime) {
      if (!runtime) return []
      if (runtime.stages?.length) return runtime.stages
      return runtime.stage ? [runtime.stage] : []
    }

    function RuntimeMini({ runtime, tr }) {
      if (!runtime) return null
      const stages = runtimeStages(runtime).slice(0, 7)
      const latest = runtime.artifacts?.[0]
      const currentId = runtime.stage?.id
      return h('div', { className: 'wb-rt-mini' },
        h('div', { className: 'wb-rt-mini-head' },
          h(RuntimeStateBadge, { runtime, tr }),
          runtime.stage?.label ? h('span', { className: 'wb-rt-mini-stage', title: runtime.stage.label }, runtime.stage.label) : null,
          runtime.progress > 0 ? h('span', { className: 'wb-rt-mini-pct' }, `${Math.round(runtime.progress * 100)}%`) : null),
        stages.length ? h('div', { className: 'wb-rt-track', 'aria-label': tr('runtimePipeline') },
          stages.map((stage, index) => h('span', {
            key: stage.id || index,
            className: cx('wb-rt-step', `is-${stage.status}`, stage.id === currentId && 'is-current'),
            title: `${stage.label}${stage.status ? ` · ${stage.status}` : ''}`,
          }, h('i')))) : null,
        latest ? h('div', { className: 'wb-rt-mini-latest', title: latest.path },
          latest.kind === 'image' && latest.url
            ? h('img', { src: latest.url, alt: '', loading: 'lazy' })
            : h('span', { className: 'wb-rt-mini-art-icon' }, h(Glyph, { name: latest.kind === 'video' ? 'arrow' : 'box', size: 12 })),
          h('span', { className: 'wb-rt-mini-art-title' }, latest.title),
          h('span', { className: 'wb-rt-mini-art-time' }, relTime(latest.createdAt, tr))) : null)
    }

    function ProjectCard({ p, tr, onSelect, selectionMode, selected, onToggle }) {
      const status = p.status || 'unknown'
      const selectable = Boolean(p.topLevel && status === 'archived' && p.deletable !== false)
      const notSelectable = selectionMode && !selectable
      const choose = () => {
        if (selectionMode && selectable) onToggle(p)
        else if (!selectionMode) onSelect(p)
      }
      return h('article', {
        className: cx('wb-card', selected && 'selected', notSelectable && 'not-selectable'),
        'data-project-id': p.id,
        onClick: choose,
        tabIndex: notSelectable ? -1 : 0,
        role: 'button',
        'aria-label': p.displayName || p.name,
        'aria-pressed': selectionMode && selectable ? Boolean(selected) : undefined,
        'aria-disabled': notSelectable || undefined,
        title: notSelectable ? (p.deleteBlocked || tr('selectArchivedOnly')) : undefined,
        onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose() } },
      },
        h('div', { className: 'wb-card-top' },
          selectionMode && selectable ? h('input', {
            type: 'checkbox',
            className: 'wb-select-check',
            checked: Boolean(selected),
            onClick: (e) => e.stopPropagation(),
            onKeyDown: (e) => e.stopPropagation(),
            onChange: () => onToggle(p),
            'aria-label': `${tr('selectArchivedOnly')}: ${p.displayName || p.name}`,
          }) : null,
          h(StatusPill, { status, tr }),
          selectionMode && p.status === 'archived' && p.deletable === false
            ? h('span', { className: 'wb-chip', style: { marginLeft: 'auto' }, title: p.deleteBlocked }, tr('protected'))
            : null,
          p.pinned ? h('span', { className: 'wb-pin', title: tr('pinned') }, h(Glyph, { name: 'pin', size: 13 })) : null),
        h('div', { className: 'wb-card-name', 'data-wb-morph-title': '1', style: { marginTop: '8px' } }, p.displayName || p.name),
        h(RuntimeMini, { runtime: p.runtime, tr }),
        h('div', { className: cx('wb-card-note', !p.note && !p.summary && 'empty') },
          p.note || p.summary || tr('noSummary')),
        h('div', { className: 'wb-card-meta' },
          p.needsFollowup ? h('span', { className: 'wb-chip accent' }, tr('followupNew')) : null,
          h('span', null, relTime(p.lastActivity, tr)),
          h('span', null, '·'),
          h('span', null, tr('sessionCountLabel', { n: p.sessionCount || 0 })),
          h('span', null, '·'),
          h('span', null, tr('folderCountLabel', { n: p.folderCount || 1 })),
          h('span', null, '·'),
          h('span', null, fmtBytes(p.sizeBytes))),
        h('div', { className: 'wb-card-foot' },
          (p.tags || []).slice(0, 2).map((tag) => h('span', { className: 'wb-chip', key: tag }, tag)),
          h('span', { className: 'wb-path', title: p.path }, p.path)))
    }

    function ProjectWallCard({ p, index, featured, wide, tr, onSelect }) {
      const media = (p.runtime?.artifacts || []).filter((artifact) => artifact.kind === 'image' && artifact.url)
      const cover = media[0]?.url || ''
      const runtimeState = p.runtime?.state || ''
      const tone = runtimeState === 'running' ? 'running' : runtimeState === 'waiting' ? 'waiting' : runtimeState === 'blocked' || runtimeState === 'failed' ? 'failed' : p.needsFollowup ? 'attention' : p.status === 'active' ? 'active' : 'idle'
      const label = runtimeState ? tr(RUNTIME_STATE_KEYS[runtimeState] || 'runtimeUnknown') : statusLabel(p.status, tr)
      const note = p.note || p.summary || ''
      const choose = () => onSelect(p)
      return h('article', {
        className: cx('wb-wall-card', featured && 'is-feature', wide && 'is-wide', `is-${tone}`),
        'data-project-id': p.id,
        style: { '--wb-accent': projectAccent(p), '--wb-wall-i': index },
        role: 'button', tabIndex: 0, onClick: choose,
        onKeyDown: (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose() } },
      },
        h('div', { className: 'wb-wall-visual' },
          h('div', { className: 'wb-wall-sigil' },
            h('span', { className: 'wb-wall-mark' }, projectMark(p)),
            h('small', null, p.kind || tr('projectLabel'))),
          cover
            ? h('img', { className: 'wb-wall-cover', src: cover, alt: '', loading: index < 2 ? 'eager' : 'lazy', onError: (event) => { event.currentTarget.style.display = 'none' } })
            : null,
          h('div', { className: 'wb-wall-shade' }),
          h('div', { className: 'wb-wall-topline' },
            h('span', { className: cx('wb-wall-state', `is-${tone}`) }, h('i', null), label),
            p.needsFollowup ? h('span', { className: 'wb-wall-flag' }, tr('followupNew')) : null),
          h('span', { className: 'wb-wall-arrow' }, h(Glyph, { name: 'arrow', size: featured ? 18 : 15 })),
          featured ? h('span', { className: 'wb-wall-index' }, String(index + 1).padStart(2, '0')) : null),
        h('div', { className: 'wb-wall-copy' },
          h('div', { className: 'wb-wall-name-row' },
            h('h2', { className: 'wb-wall-name', 'data-wb-morph-title': '1' }, p.displayName || p.name),
            h('span', { className: cx('wb-life-chip', `is-${p.lifecycle || 'unclassified'}`), title: lifecycleSourceLabel(p.lifecycleSource, tr) }, lifecycleLabel(p.lifecycle, tr)),
            h('span', { className: 'wb-wall-size' }, fmtBytes(p.sizeBytes))),
          h('div', { className: 'wb-wall-path', title: p.path }, p.path),
          note ? h('p', { className: 'wb-wall-note' }, truncate(note, featured ? 120 : 74)) : null,
          featured && (p.runtime?.stage?.label || (Number.isFinite(p.runtime?.progress) && p.runtime.progress > 0)) ? h('div', { className: 'wb-wall-stage' }, h('i', null), h('span', null, p.runtime?.stage?.label || tr(RUNTIME_STATE_KEYS[p.runtime?.state] || 'runtimeUnknown')), Number.isFinite(p.runtime?.progress) ? h('b', null, `${Math.round(p.runtime.progress * 100)}%`) : null) : null,
          h('div', { className: 'wb-wall-meta' },
            h('span', null, tr('sessionCountLabel', { n: p.sessionCount || 0 })),
            p.git?.branch ? h('span', { className: 'wb-wall-branch' }, h(Glyph, { name: 'fork', size: 11 }), p.git.branch) : null,
            h('span', { className: 'wb-wall-time' }, relTime(p.lastActivity, tr)))))
    }

    const EARTH_DAY_URL = '/dsh-workbench/assets/earth-blue-marble.jpg'
    const EARTH_NIGHT_URL = '/dsh-workbench/assets/earth-night.jpg'
    const EARTH_RETURN_KEY = 'wb-earth-return'
    const EARTH_RAD = Math.PI / 180
    function earthHash(value) {
      return [...String(value || '')].reduce((sum, char) => ((sum * 31 + char.charCodeAt(0)) >>> 0), 7)
    }

    function earthCoords(project) {
      const anchor = project?.earthAnchor
      if (Number.isFinite(anchor?.lat) && Number.isFinite(anchor?.lon) && Math.abs(anchor.lat) <= 90 && Math.abs(anchor.lon) <= 180) {
        return { lat: anchor.lat, lon: anchor.lon }
      }
      // A stable project ID is the sole input: sorting, renaming or changing
      // lifecycle must not silently move a project's automatic placeholder.
      const id = String(project?.id || '')
      const mix = (value) => {
        value ^= value >>> 16; value = Math.imul(value, 0x7feb352d)
        value ^= value >>> 15; value = Math.imul(value, 0x846ca68b)
        return (value ^ (value >>> 16)) >>> 0
      }
      const latSeed = mix(earthHash('lat:' + id)) / 0xffffffff
      const lonSeed = mix(earthHash('lon:' + id)) / 0xffffffff
      return { lat: Math.asin(2 * latSeed - 1) / EARTH_RAD, lon: lonSeed * 360 - 180 }
    }

    function earthReduced() {
      return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)
    }

    function earthOrbitDistance() {
      return typeof window !== 'undefined' && window.innerWidth >= 1200 ? 4.8 : 5.6
    }

    function earthPinchDistance(distance, startSpan, currentSpan) {
      if (!Number.isFinite(distance) || !Number.isFinite(startSpan) || !Number.isFinite(currentSpan) || startSpan <= 0 || currentSpan <= 0) return distance
      return Math.max(1.52, Math.min(8, distance * startSpan / currentSpan))
    }

    function earthOrbitEye(view) {
      return [
        Math.cos(view.pitch) * Math.sin(view.yaw) * view.distance,
        Math.sin(view.pitch) * view.distance,
        Math.cos(view.pitch) * Math.cos(view.yaw) * view.distance,
      ]
    }

    function earthProjectPointOnGlobe(model) {
      const lat = model.lat * EARTH_RAD
      const lon = model.lon * EARTH_RAD
      return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon)]
    }

    // A satellite descends onto the clicked surface point; it never orbits the globe
    // to move that point to the centre first. The project scene is the local ground.
    function earthFlightEye(fromEye, toEye, t) {
      const r0 = Math.hypot(...fromEye) || 1
      const r1 = Math.hypot(...toEye) || 1
      const a = fromEye.map((value) => value / r0)
      const b = toEye.map((value) => value / r1)
      const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))
      const mix = (index) => fromEye[index] + (toEye[index] - fromEye[index]) * t
      // The straight camera line is only safe while it stays outside the
      // planet. Check the segment before using it; a visible marker can still
      // produce a chord that grazes the sphere at a shallow radius.
      if (dot > 0.2) {
        let clear = true
        for (const k of [0.2, 0.4, 0.6, 0.8]) {
          const point = fromEye.map((value, index) => value + (toEye[index] - value) * k)
          if (Math.hypot(...point) < 1.04) { clear = false; break }
        }
        if (clear) return [mix(0), mix(1), mix(2)]
      }
      const angle = Math.acos(dot)
      const sin = Math.sin(angle)
      if (angle < 0.0001) return [mix(0), mix(1), mix(2)]
      const radius = Math.max(1.04, r0 + (r1 - r0) * t)
      // At (or very near) antipodal directions the cross product has no
      // usable plane. Pick a stable perpendicular axis and rotate a half
      // turn around it, so the camera goes around the planet instead of
      // collapsing to a straight line through the centre.
      let axis = [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
      ]
      let axisLength = Math.hypot(...axis)
      if (axisLength < 0.0001) {
        axis = [a[1], -a[0], 0]
        axisLength = Math.hypot(...axis)
        if (axisLength < 0.0001) axis = [0, a[2], -a[1]]
        axisLength = Math.hypot(...axis) || 1
      }
      axis = axis.map((value) => value / axisLength)
      if (Math.abs(sin) < 0.0001) {
        const halfTurn = Math.PI * t
        return a.map((value, index) => (value * Math.cos(halfTurn) + axis[index] * Math.sin(halfTurn)) * radius)
      }
      const k0 = Math.sin((1 - t) * angle) / sin
      const k1 = Math.sin(t * angle) / sin
      return a.map((value, index) => (value * k0 + b[index] * k1) * radius)
    }

    function earthApproachCamera(model) {
      const point = earthProjectPointOnGlobe(model)
      const altitude = 0.72
      return { eye: point.map((value) => value * (1 + altitude)), target: point }
    }

    // Fade in the actual daytime imagery near the surface, so unlit terrain
    // remains legible at night without changing the solar terminator.
    function earthTerrainAssist(eye) {
      const distance = Math.hypot(...eye)
      const progress = Math.max(0, Math.min(1, (3 - distance) / (3 - 1.72)))
      return 0.68 * progress * progress * (3 - 2 * progress)
    }

    function earthCompile(gl, type, source) {
      const shader = gl.createShader(type)
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader)
        gl.deleteShader(shader)
        throw new Error(message || 'shader compile failed')
      }
      return shader
    }

    function earthPerspective(fovy, aspect, near, far) {
      const f = 1 / Math.tan(fovy / 2)
      const nf = 1 / (near - far)
      return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]
    }

    function earthLookAt(eye, center, up = [0, 1, 0]) {
      const z = [eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]]
      const zl = Math.hypot(...z) || 1
      z[0] /= zl; z[1] /= zl; z[2] /= zl
      let x = [up[1] * z[2] - up[2] * z[1], up[2] * z[0] - up[0] * z[2], up[0] * z[1] - up[1] * z[0]]
      let xl = Math.hypot(...x)
      if (xl < 1e-8) {
        // At either geographic pole, the default up vector is parallel to
        // the camera direction. Use a perpendicular axis instead.
        const alternate = Math.abs(z[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]
        x = [alternate[1] * z[2] - alternate[2] * z[1], alternate[2] * z[0] - alternate[0] * z[2], alternate[0] * z[1] - alternate[1] * z[0]]
        xl = Math.hypot(...x) || 1
      }
      x[0] /= xl; x[1] /= xl; x[2] /= xl
      const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]]
      return [
        x[0], y[0], z[0], 0,
        x[1], y[1], z[1], 0,
        x[2], y[2], z[2], 0,
        -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]),
        -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]),
        -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]),
        1,
      ]
    }

    function earthProjectPoint(point, view, projection, width, height) {
      const x = view[0] * point[0] + view[4] * point[1] + view[8] * point[2] + view[12]
      const y = view[1] * point[0] + view[5] * point[1] + view[9] * point[2] + view[13]
      const z = view[2] * point[0] + view[6] * point[1] + view[10] * point[2] + view[14]
      const w = -z
      if (w <= 0.015) return null
      const ndcX = (projection[0] * x) / w
      const ndcY = (projection[5] * y) / w
      if (Math.abs(ndcX) > 1.25 || Math.abs(ndcY) > 1.25) return null
      return { x: (ndcX * 0.5 + 0.5) * width, y: (-ndcY * 0.5 + 0.5) * height }
    }

    function earthPointVisible(point, eye) {
      // A unit-sphere surface point is above the horizon iff the camera is
      // outside its tangent plane. A simple front-hemisphere test is wrong
      // when the camera is close to the globe.
      return point[0] * eye[0] + point[1] * eye[1] + point[2] * eye[2] >= 1 - 1e-7
    }

    function earthMarkerViewport(canvas) {
      return { width: canvas.clientWidth, height: canvas.clientHeight }
    }

    // Convert a CSS-pixel pointer position into a ray in the current WebGL
    // camera and intersect it with the actual unit globe. Return null for
    // clicks in space, invalid viewports, or a camera without a valid frame.
    function earthPickCoords(clientX, clientY, rect, camera) {
      const width = rect?.width, height = rect?.height
      const view = camera?.view, projection = camera?.projection, eye = camera?.eye
      if (![clientX, clientY, rect?.left, rect?.top, width, height].every(Number.isFinite) || width <= 0 || height <= 0 ||
          !Array.isArray(eye) || eye.length !== 3 || !eye.every(Number.isFinite) || !view || !projection ||
          !Number.isFinite(projection[0]) || !Number.isFinite(projection[5]) || !projection[0] || !projection[5]) return null
      const nx = 2 * (clientX - rect.left) / width - 1
      const ny = 1 - 2 * (clientY - rect.top) / height
      if (Math.abs(nx) > 1 || Math.abs(ny) > 1) return null
      const x = nx / projection[0], y = ny / projection[5]
      const direction = [view[0] * x + view[1] * y - view[2], view[4] * x + view[5] * y - view[6], view[8] * x + view[9] * y - view[10]]
      if (!direction.every(Number.isFinite)) return null
      const a = direction.reduce((sum, n) => sum + n * n, 0)
      const b = 2 * direction.reduce((sum, n, i) => sum + n * eye[i], 0)
      const c = eye.reduce((sum, n) => sum + n * n, 0) - 1
      const discriminant = b * b - 4 * a * c
      if (!(a > 0) || discriminant < 0) return null
      const near = (-b - Math.sqrt(discriminant)) / (2 * a)
      const far = (-b + Math.sqrt(discriminant)) / (2 * a)
      const distance = near >= 0 ? near : far >= 0 ? far : -1
      if (distance < 0) return null
      const point = eye.map((value, i) => value + direction[i] * distance)
      return { lat: Math.asin(Math.max(-1, Math.min(1, point[1]))) / EARTH_RAD, lon: Math.atan2(-point[2], point[0]) / EARTH_RAD }
    }

    function earthSunVector(date = new Date()) {
      const start = Date.UTC(date.getUTCFullYear(), 0, 0)
      const day = (date.getTime() - start) / 86400000
      const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600
      const lon = (180 - hours * 15) * EARTH_RAD
      const decl = -23.44 * Math.cos((2 * Math.PI / 365) * (day + 10)) * EARTH_RAD
      return [Math.cos(decl) * Math.cos(lon), Math.sin(decl), -Math.cos(decl) * Math.sin(lon)]
    }

    function earthSphere(segments = 128, rings = 64) {
      const positions = []
      const uvs = []
      const indices = []
      for (let y = 0; y <= rings; y += 1) {
        const v = y / rings
        const lat = Math.PI / 2 - v * Math.PI
        for (let x = 0; x <= segments; x += 1) {
          const u = x / segments
          const lon = u * Math.PI * 2 - Math.PI
          positions.push(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon))
          uvs.push(u, 1 - v)
        }
      }
      for (let y = 0; y < rings; y += 1) {
        for (let x = 0; x < segments; x += 1) {
          const a = y * (segments + 1) + x
          const b = a + 1
          const c = a + segments + 1
          const d = c + 1
          indices.push(a, c, b, b, c, d)
        }
      }
      return { positions: new Float32Array(positions), uvs: new Float32Array(uvs), indices: new Uint16Array(indices) }
    }

    function earthLoadTexture(gl, url) {
      return new Promise((resolve) => {
        const image = new Image()
        image.decoding = 'async'
        image.onload = () => {
          const texture = gl.createTexture()
          gl.bindTexture(gl.TEXTURE_2D, texture)
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
          gl.generateMipmap(gl.TEXTURE_2D)
          resolve(texture)
        }
        image.onerror = () => resolve(null)
        image.src = url
      })
    }

    function earthFlatTexture(gl, color) {
      const texture = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(color))
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      return texture
    }

    function MediaImage({ item, className, alt, onError }) {
      const [failed, setFailed] = useState(false)
      useEffect(() => { setFailed(false) }, [item?.url])
      if (!item?.url || failed) return h('div', { className: 'wb-media-missing' }, h(Glyph, { name: 'image', size: 18 }))
      return h('img', {
        className, src: item.url, alt: alt || item.title || '', loading: 'lazy', decoding: 'async',
        onError: () => { setFailed(true); onError?.() },
      })
    }

    function ProjectMediaAnchor({ project, media, tr, onOpen, onChoose }) {
      const data = media?.data
      const item = data?.representative || data?.items?.[0] || null
      const scan = data?.scan || null
      const loading = media?.status === 'loading' && !data
      const failed = media?.status === 'error' || (data?.error && !item)
      let empty = null
      if (loading) empty = tr('earthMediaLoading')
      else if (failed) empty = tr('earthMediaFailed')
      else if (!item) empty = scan ? tr('earthMediaNone', { roots: scan.roots, dirs: scan.scannedDirs }) : tr('earthMediaNone', { roots: 0, dirs: 0 })
      return h('div', { className: 'wb-anchor-media' },
        item ? h('div', {
          className: 'wb-anchor-media-button', role: 'button', tabIndex: 0,
          onClick: () => onOpen(project),
          onKeyDown: (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(project) } },
          'aria-label': tr('earthAnchorOpen') + ': ' + (project.displayName || project.name),
        },
          h(MediaImage, { item, className: 'wb-anchor-media-image', alt: project.displayName || project.name }),
          h('span', { className: 'wb-anchor-media-shade' }),
          h('span', { className: 'wb-anchor-media-caption' }, tr('earthAnchorOpen'), ' ↗'),
          h('button', {
            type: 'button', className: 'wb-anchor-media-change', title: tr('earthMediaChange'),
            onClick: (event) => { event.stopPropagation(); onChoose() },
          }, tr('earthMediaChange'))) : h('button', {
          type: 'button', className: 'wb-anchor-media-empty', onClick: onChoose,
        }, h(Glyph, { name: 'image', size: 18 }), h('span', null, empty), h('b', null, tr('earthMediaChoose'))),
        h('div', { className: 'wb-anchor-media-meta' },
          item ? h('span', null, item.source || tr('earthMediaSource'), ' · ', item.rootLabel || '') : null,
          scan ? h('span', null, tr('earthMediaScanMeta', { roots: scan.roots, images: scan.images })) : null,
          project.representativeImage ? h('span', { className: 'is-pinned' }, tr('earthMediaPinned')) : null),
        data?.pinnedMissing ? h('p', { className: 'wb-anchor-warning' }, tr('earthMediaPinnedMissing')) : null)
    }

    // Older overrides may only store a path (or folder -1). In that case the
    // server resolves the first matching image; highlight that one only.
    function mediaMatchesRepresentative(pinned, item, resolved) {
      if (!pinned || !item || pinned.path !== item.path) return false
      if (Number.isInteger(pinned.folder) && pinned.folder >= 0) return pinned.folder === item.folder
      return Boolean(resolved && resolved.path === item.path && resolved.folder === item.folder)
    }

    function ProjectMediaPicker({ project, tr, onClose, onApply }) {
      const media = useProjectMedia(project.id, project.representativeImage?.path || '')
      const [manual, setManual] = useState('')
      const [extra, setExtra] = useState(null)
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState('')
      const items = useMemo(() => {
        const list = [...(media.data?.items || [])]
        if (extra && !list.some((item) => item.path === extra.path && item.folder === extra.folder)) list.unshift(extra)
        return list
      }, [media.data, extra])
      const apply = async (item) => {
        if (busy) return
        setBusy(true); setError('')
        const result = await onApply(item)
        setBusy(false)
        if (!result?.ok) setError(result?.error || tr('earthMediaFailed'))
        else onClose()
      }
      const probe = async () => {
        const path = manual.trim()
        if (!path || busy) return
        setBusy(true); setError('')
        try {
          const response = await fetch(API + '/project-media?id=' + encodeURIComponent(project.id) + '&path=' + encodeURIComponent(path), { cache: 'no-store' })
          const data = await response.json().catch(() => ({}))
          if (!response.ok || data.ok === false || !data.item) throw new Error(data.error || ('HTTP ' + response.status))
          setExtra(data.item)
          await apply(data.item)
        } catch (err) {
          setError(err?.message || tr('earthMediaFailed'))
        } finally { setBusy(false) }
      }
      const scan = media.data?.scan
      return h('div', { className: 'wb-media-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': tr('earthMediaPickerTitle'), onClick: (event) => { if (event.target === event.currentTarget) onClose() } },
        h('section', { className: 'wb-media-picker' },
          h('header', { className: 'wb-media-picker-head' },
            h('div', null,
              h('div', { className: 'wb-earth-overline' }, tr('earthAnchorKicker')),
              h('h2', null, tr('earthMediaPickerTitle')),
              h('p', null, tr('earthMediaPickerHint'))),
            h('button', { type: 'button', className: 'wb-media-close', onClick: onClose, 'aria-label': tr('close') }, '×')),
          h('div', { className: 'wb-media-picker-status' },
            media.status === 'loading' ? tr('earthMediaLoading') : scan ? tr('earthMediaScanMeta', { roots: scan.roots, images: scan.images }) : '',
            project.representativeImage ? h('button', { type: 'button', className: 'wb-btn ghost', disabled: busy, onClick: () => apply(null) }, tr('earthMediaClear')) : null),
          items.length ? h('div', { className: 'wb-media-grid' }, items.map((item) => {
            const pinned = mediaMatchesRepresentative(project.representativeImage, item, media.data?.representative)
            return h('button', {
              key: item.folder + ':' + item.path, type: 'button', className: cx('wb-media-cell', pinned && 'is-pinned'), disabled: busy,
              onClick: () => apply(item), title: item.path,
            },
              h(MediaImage, { item, className: 'wb-media-cell-image', alt: item.title || item.path }),
              h('span', { className: 'wb-media-cell-name' }, item.title || item.path),
              h('span', { className: 'wb-media-cell-meta' }, item.source || '', ' · ', item.rootLabel || ''),
              pinned ? h('span', { className: 'wb-media-cell-pin' }, tr('earthMediaPinned')) : null)
          })) : h('div', { className: 'wb-media-empty' }, h(Glyph, { name: 'image', size: 22 }), h('b', null, tr('earthMediaNoMatch')), h('span', null, scan ? tr('earthMediaNone', { roots: scan.roots, dirs: scan.scannedDirs }) : tr('earthMediaLoading'))),
          h('div', { className: 'wb-media-manual' },
            h('label', null, tr('earthMediaManual')),
            h('div', null,
              h('input', { className: 'wb-input', value: manual, onChange: (event) => setManual(event.target.value), placeholder: tr('earthMediaManualPlaceholder'), onKeyDown: (event) => { if (event.key === 'Enter') { event.preventDefault(); probe() } } }),
              h('button', { type: 'button', className: 'wb-btn', disabled: busy || !manual.trim(), onClick: probe }, tr('earthMediaApply')))),
          error ? h('p', { className: 'wb-media-error', role: 'alert' }, error) : null,
          h('footer', { className: 'wb-media-picker-foot' },
            h('span', null, media.data?.roots ? media.data.roots.map((root) => root.label + ' · ' + root.role).join(' / ') : ''),
            h('button', { type: 'button', className: 'wb-btn ghost', onClick: onClose }, tr('earthMediaCancel')))))
    }

    // Trusted, source-controlled scene definitions. A contributor can add an
    // entry here and implement its component; this is not a runtime plugin API.
    // Each binding receives shared project actions plus owned scene state.
    const SCENE_REGISTRY = [
      { id: 'earth', labelKey: 'sceneEarth', backLabelKey: 'sceneBackEarth', icon: 'globe', component: EarthView,
        bind: ({ common }) => common },
      { id: 'studio', labelKey: 'sceneStudio', backLabelKey: 'sceneStudioBackStudio', icon: 'grid', component: StudioView,
        bind: ({ common, studio }) => ({ ...common, ...studio }) },
      { id: 'library', labelKey: 'sceneLibrary', backLabelKey: 'sceneBackLibrary', icon: 'library', component: LibraryView,
        bind: ({ common, library }) => ({ ...common, ...library }) },
      { id: 'time', labelKey: 'sceneTime', backLabelKey: 'sceneBackTime', icon: 'clock', component: TimeView,
        bind: ({ common, time }) => ({ ...common, ...time }) },
    ]

    // Only a small, validated JSON preference is stored here. It never loads
    // code, project data, files or scene implementations from storage.
    const SCENE_PREFERENCES_KEY = 'dsh-project-atlas.scene-preferences.v1'
    function normalizeScenePreferences(value, registry = SCENE_REGISTRY) {
      const ids = registry.map((item) => item.id)
      const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
      const order = []
      for (const id of Array.isArray(input.order) ? input.order : []) {
        if (ids.includes(id) && !order.includes(id)) order.push(id)
      }
      for (const id of ids) if (!order.includes(id)) order.push(id)
      let hidden = Array.isArray(input.hidden) ? [...new Set(input.hidden.filter((id) => ids.includes(id)))] : []
      if (hidden.length >= ids.length) hidden = []
      const visible = order.filter((id) => !hidden.includes(id))
      const start = visible.includes(input.start) ? input.start : visible[0]
      return { order, hidden, start }
    }

    function readScenePreferences(storage, registry = SCENE_REGISTRY) {
      try { return normalizeScenePreferences(JSON.parse(storage?.getItem(SCENE_PREFERENCES_KEY) || 'null'), registry) }
      catch { return normalizeScenePreferences(null, registry) }
    }

    function writeScenePreferences(storage, value, registry = SCENE_REGISTRY) {
      try {
        if (!storage) return false
        storage.setItem(SCENE_PREFERENCES_KEY, JSON.stringify(normalizeScenePreferences(value, registry)))
        return true
      } catch { return false }
    }

    function sceneStorage() {
      try { return window.localStorage } catch { return null }
    }

    function SceneSettings({ value, onChange, tr, storageError }) {
      const visibleCount = value.order.length - value.hidden.length
      const move = (id, delta) => {
        const order = [...value.order]
        const index = order.indexOf(id), next = index + delta
        if (index < 0 || next < 0 || next >= order.length) return
        ;[order[index], order[next]] = [order[next], order[index]]
        onChange({ ...value, order })
      }
      return h('details', { className: 'wb-scene-settings' },
        h('summary', null, tr('sceneSettings')),
        h('div', { className: 'wb-scene-settings-panel' },
          h('p', null, tr('sceneSettingsHint')),
          h('label', null, tr('sceneSettingsStart'),
            h('select', { value: value.start, 'aria-label': tr('sceneSettingsStart'), onChange: (event) => onChange({ ...value, start: event.target.value }) },
              value.order.filter((id) => !value.hidden.includes(id)).map((id) => h('option', { key: id, value: id }, tr(findScene(id).labelKey))))),
          h('div', { className: 'wb-scene-settings-list' }, value.order.map((id, index) => {
            const scene = findScene(id), name = tr(scene.labelKey), hidden = value.hidden.includes(id)
            return h('div', { key: id, className: 'wb-scene-settings-row' },
              h('label', null, h('input', { type: 'checkbox', 'aria-label': tr('sceneSettingsShow', { name }), checked: !hidden, disabled: !hidden && visibleCount === 1,
                onChange: (event) => onChange({ ...value, hidden: event.target.checked ? value.hidden.filter((item) => item !== id) : [...value.hidden, id] }) }), name),
              h('button', { type: 'button', className: 'wb-btn', disabled: index === 0, 'aria-label': tr('sceneSettingsUp', { name }), title: tr('sceneSettingsUp', { name }), onClick: () => move(id, -1) }, h('span', { 'aria-hidden': 'true' }, '↑'), h('span', { className: 'wb-scene-settings-sr' }, tr('sceneSettingsUp', { name }))),
              h('button', { type: 'button', className: 'wb-btn', disabled: index === value.order.length - 1, 'aria-label': tr('sceneSettingsDown', { name }), title: tr('sceneSettingsDown', { name }), onClick: () => move(id, 1) }, h('span', { 'aria-hidden': 'true' }, '↓'), h('span', { className: 'wb-scene-settings-sr' }, tr('sceneSettingsDown', { name }))))
          })),
          h('button', { type: 'button', className: 'wb-btn', onClick: () => onChange(null) }, tr('sceneSettingsReset')),
          storageError ? h('p', { role: 'status', className: 'wb-scene-settings-error' }, tr('sceneSettingsStorageError')) : null))
    }

    function findScene(id, registry = SCENE_REGISTRY) {
      return registry.find((item) => item.id === id) || null
    }

    function canNavigateToView(id) {
      return id === 'table' || Boolean(findScene(id))
    }

    function projectHistoryState(state, next, current) {
      const previousEntry = state?.dshWorkbench?.entry
      return { ...(state || {}), dshWorkbench: { projectId: next.projectId, tab: next.tab, entry: current.name === 'index' ? 'wall' : (previousEntry || 'direct') } }
    }

    function workspaceSaveSnapshot({ id, note, tags, status, pinned, hidden }) {
      return JSON.stringify([id, note, tags, status, pinned, hidden])
    }

    function workspaceSaveIsCurrent(savedSnapshot, current) {
      return savedSnapshot !== null && savedSnapshot === workspaceSaveSnapshot(current)
    }

    async function attemptWorkspaceLeave(ref, dirty, save, onClose) {
      if (ref.current) return false
      ref.current = true
      try {
        if (dirty && !(await save())) { ref.current = false; return false }
        onClose()
        return true
      } catch { ref.current = false; return false }
    }

    async function savePendingWorkspaceChanges({ taskDirty, confirmDiscard, dirty, save, intentDirty, saveLifecycle, unchanged = () => true }) {
      if (taskDirty && !confirmDiscard()) return false
      if (dirty && !(await save())) return false
      if (intentDirty && !(await saveLifecycle())) return false
      return unchanged()
    }

    async function guardProjectSwitch(ref, guard, confirm, proceed) {
      if (ref.current) return false
      ref.current = true
      try {
        if (guard?.dirty && (!confirm() || !(await guard.save()))) return false
        proceed()
        return true
      } catch { return false } finally { ref.current = false }
    }

    function handleWorkspaceEscape(event, { taskOpen, setTaskOpen, leave }, doc = document) {
      if (event.key !== 'Escape') return false
      if (doc.querySelector('[role="dialog"][aria-modal="true"]')) return true
      if (taskOpen) { event.preventDefault(); setTaskOpen(false); return true }
      const target = event.target
      if (target && target.closest && target.closest('input,textarea,select,[contenteditable="true"]')) return true
      event.preventDefault()
      leave()
      return true
    }

    // Browser history has already moved by popstate. Restore the current entry
    // first, then replay the requested jump only after confirmation and save.
    function createProjectPopGuard({ history, getCurrent, getGuard, confirm, apply }) {
      let pending = null
      return async (state) => {
        const current = getCurrent()
        const target = state?.wbAtlasHistory
        if (pending?.phase === 'restoring') {
          if (target?.session !== pending.session) return
          if (target.index !== pending.origin) { history.go(pending.origin - target.index); return }
          pending.phase = 'checking'
          const accepted = confirm()
          let saved = false
          if (accepted) {
            try { saved = await pending.save() } catch { saved = false }
          }
          if (!saved) { pending = null; return }
          pending.phase = 'replaying'
          history.go(pending.target - pending.origin)
          return
        }
        if (pending?.phase === 'checking') {
          if (target?.session === pending.session && target.index !== pending.origin) history.go(pending.origin - target.index)
          return
        }
        if (pending?.phase === 'replaying') {
          if (target?.session !== pending.session || target.index !== pending.target) return
          pending = null
          apply(state)
          return
        }
        if (pending?.phase === 'replaying-unknown') {
          pending = null
          apply(state)
          return
        }
        const guard = getGuard()
        const leaving = current.route?.name === 'project' && state?.dshWorkbench?.projectId !== current.route.projectId
        if (!guard?.dirty || !leaving) { apply(state); return }
        const origin = current.state?.wbAtlasHistory
        if (origin && target?.session === origin.session && Number.isInteger(target.index) && target.index !== origin.index) {
          pending = { phase: 'restoring', session: origin.session, origin: origin.index, target: target.index, save: guard.save }
          history.go(origin.index - target.index)
          return
        }
        // An entry not created by this workbench has no known direction. Restore
        // a same-URL copy rather than risking silent data loss; forward history
        // may be discarded for this uncommon interleaved-history case.
        try { history.pushState(current.state, '', current.url) } catch { return }
        if (!confirm()) return
        let saved = false
        try { saved = await guard.save() } catch { saved = false }
        if (saved) { pending = { phase: 'replaying-unknown' }; history.back() }
      }
    }

    function sceneModeFor(route, tab, scene) {
      return route.name === 'index' && tab === 'projects' && Boolean(scene)
    }

    function sceneBackLabel(id, fromEarthLanding, registry = SCENE_REGISTRY) {
      if (id === 'earth' && fromEarthLanding) return 'roomBackDetail'
      return findScene(id, registry)?.backLabelKey || 'sceneBackEarth'
    }

    function renderScene(scene, context) {
      return h(scene.component, scene.bind(context))
    }

    function SceneSwitch({ current, onScene, tr, variant = 'default', scenes = SCENE_REGISTRY }) {
      return h('div', {
        className: cx('wb-scene-switch', `is-${variant}`),
        role: 'group', 'aria-label': tr('earthSceneSwitch'),
      }, scenes.map((item) => {
        const label = tr(item.labelKey)
        return h('button', {
          key: item.id, type: 'button',
          className: cx('wb-scene-button', item.id === current && 'is-current'),
          title: label,
          'aria-label': label,
          'aria-current': item.id === current ? 'page' : undefined,
          onClick: () => onScene?.(item.id),
        },
          h(Glyph, { name: item.icon, size: 13 }),
          h('span', { className: 'wb-scene-label' }, label))
      }))
    }

    function parseEarthAnchorDraft(latitude, longitude) {
      const latText = String(latitude ?? '').trim(), lonText = String(longitude ?? '').trim()
      if (!latText || !lonText) return null
      const lat = Number(latText), lon = Number(lonText)
      return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 ? { lat, lon } : null
    }

    // The preview dot is 12 CSS pixels plus a 2-pixel border on each side.
    // The flex row is vertically centered on that dot; center the dot itself
    // on the projected coordinate, rather than its upper-left corner.
    function earthAnchorPreviewTransform(screen) {
      return `translate3d(${screen.x}px, ${screen.y}px, 0) translate(-8px, -50%)`
    }

    function finishEarthReturn(flight, { onActive, setIndexOpen, setIndexPreviewId }) {
      if (flight?.preserveSelection) return
      onActive('')
      setIndexOpen(true)
      setIndexPreviewId('')
    }

    async function submitEarthAnchor(id, anchor, request = fetch) {
      const response = await request(API + '/override', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, patch: { earthAnchor: anchor } }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + response.status))
      return data
    }

    async function refreshEarthAnchor(refresh) {
      if (typeof refresh !== 'function') return false
      try { return (await refresh()) !== false } catch { return false }
    }

    async function saveAndRefreshEarthAnchor(id, anchor, refresh, request = fetch) {
      await submitEarthAnchor(id, anchor, request)
      return refreshEarthAnchor(refresh)
    }

    function EarthAnchorEditor({ editor, tr, onChange, onPick, onSave, onReset, onCancel, onRetryRefresh }) {
      return h('form', { className: 'wb-earth-anchor-editor', 'aria-label': tr('earthAnchorEditTitle'), onSubmit: (event) => { event.preventDefault(); onSave() } },
        h('h3', null, tr('earthAnchorEditTitle')),
        h('p', null, editor.projectName),
        h('p', null, tr('earthAnchorEditHint')),
        h('div', { className: 'wb-earth-anchor-fields' },
          h('label', null, tr('earthAnchorLatitude'), h('input', { type: 'number', step: 'any', min: '-90', max: '90', inputMode: 'decimal', value: editor.lat, disabled: editor.busy || editor.refreshFailed, onChange: (event) => onChange('lat', event.target.value) })),
          h('label', null, tr('earthAnchorLongitude'), h('input', { type: 'number', step: 'any', min: '-180', max: '180', inputMode: 'decimal', value: editor.lon, disabled: editor.busy || editor.refreshFailed, onChange: (event) => onChange('lon', event.target.value) }))),
        editor.picking ? h('p', { className: 'is-status', role: 'status' }, tr('earthAnchorPicking')) : null,
        editor.error ? h('p', { className: 'is-error', role: 'alert' }, editor.error) : null,
        h('div', { className: 'wb-earth-anchor-controls' },
          h('button', { type: 'button', className: 'wb-btn', disabled: editor.busy || editor.refreshFailed, onClick: onPick, 'aria-pressed': editor.picking }, tr('earthAnchorPick')),
          h('button', { type: 'submit', className: 'wb-btn primary', disabled: editor.busy || editor.refreshFailed }, tr('earthAnchorSave')),
          h('button', { type: 'button', className: 'wb-btn', disabled: editor.busy || editor.refreshFailed, onClick: onReset }, tr('earthAnchorReset')),
          editor.refreshFailed ? h('button', { type: 'button', className: 'wb-btn primary', disabled: editor.busy, onClick: onRetryRefresh }, tr('earthAnchorRetryRefresh')) : null,
          h('button', { type: 'button', className: 'wb-btn ghost', disabled: editor.busy, onClick: onCancel }, tr('earthAnchorCancel'))))
    }

    function EarthView({ projects, activeId, onActive, onOpen, onOpenPath, onRefresh, onScene, tr }) {
      const canvasRef = useRef(null)
      const stageRef = useRef(null)
      const indexListRef = useRef(null)
      const markerNodes = useRef({})
      const stateRef = useRef({
        yaw: -0.45, pitch: 0.18, distance: earthOrbitDistance(),
        targetYaw: -0.45, targetPitch: 0.18, targetDistance: earthOrbitDistance(),
        playing: !earthReduced(), dragging: false, flight: null, camera: null, cameraOverride: null, flightCamera: null,
      })
      const models = useMemo(() => projects.map((project, index) => ({
        project, id: project.id, index, ...earthCoords(project, index),
        label: index < 12 || project.pinned || project.lifecycle === 'persistent',
      })), [projects])
      const modelsRef = useRef(models)
      modelsRef.current = models
      const activeIdRef = useRef(activeId)
      activeIdRef.current = activeId
      const orbitRestoreRef = useRef(false)
      const activeModel = models.find((model) => model.id === activeId) || null
      const active = activeModel?.project || null
      const [status, setStatus] = useState('loading')
      const [failure, setFailure] = useState('')
      const [playing, setPlaying] = useState(() => !earthReduced())
      const [panorama, setPanorama] = useState(false)
      const [indexOpen, setIndexOpen] = useState(true)
      const indexVisible = indexOpen && (!active || panorama)
      const [indexQuery, setIndexQuery] = useState('')
      const indexQueryRef = useRef(indexQuery)
      indexQueryRef.current = indexQuery
      const [indexPreviewId, setIndexPreviewId] = useState('')
      const [flight, setFlight] = useState(null)
      const [landing, setLanding] = useState(null)
      const landingRef = useRef(null)
      const returnToOrbitRef = useRef(null)
      landingRef.current = landing
      const isLanding = Boolean(landing && active && landing.project?.id === active.id)
      const [clock, setClock] = useState(() => new Date())
      const [mediaPicker, setMediaPicker] = useState(false)
      const [cardAnchor, setCardAnchor] = useState(null)
      const [anchorEditor, setAnchorEditor] = useState(null)
      const [anchorMessage, setAnchorMessage] = useState('')
      const anchorPreviewRef = useRef(null)
      const activeMedia = useProjectMedia(active?.id, active?.representativeImage?.path || '')
      const dragRef = useRef(null)
      const anchorPointerRef = useRef(null)
      const touchPointsRef = useRef(new Map())
      const pinchRef = useRef(null)

      useEffect(() => {
        stateRef.current.playing = playing
      }, [playing])

      useEffect(() => {
        if (anchorEditor && activeId !== anchorEditor.projectId) setAnchorEditor(null)
      }, [activeId, anchorEditor?.projectId])

      useEffect(() => {
        if (!anchorMessage) return undefined
        const timer = window.setTimeout(() => setAnchorMessage(''), 3000)
        return () => window.clearTimeout(timer)
      }, [anchorMessage])

      useEffect(() => {
        if (!anchorEditor) return undefined
        const coords = parseEarthAnchorDraft(anchorEditor.lat, anchorEditor.lon)
        let frame = 0
        const drawPreview = () => {
          const node = anchorPreviewRef.current, camera = stateRef.current.camera
          if (node) {
            const point = coords && earthProjectPointOnGlobe(coords)
            const facing = point && camera && earthPointVisible(point, camera.eye)
            const screen = facing && stageRef.current && earthProjectPoint(point, camera.view, camera.projection, stageRef.current.clientWidth, stageRef.current.clientHeight)
            node.style.opacity = screen ? '1' : '0'
            if (screen) node.style.transform = earthAnchorPreviewTransform(screen)
          }
          frame = requestAnimationFrame(drawPreview)
        }
        frame = requestAnimationFrame(drawPreview)
        return () => cancelAnimationFrame(frame)
      }, [anchorEditor?.projectId, anchorEditor?.lat, anchorEditor?.lon])

      useEffect(() => {
        const timer = window.setInterval(() => setClock(new Date()), 30000)
        return () => window.clearInterval(timer)
      }, [])

      useEffect(() => {
        if (!panorama) return undefined
        const previous = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        document.body.classList.add('wb-earth-panorama')
        return () => {
          document.body.style.overflow = previous
          document.body.classList.remove('wb-earth-panorama')
        }
      }, [panorama])

      useEffect(() => {
        if (panorama && indexListRef.current) indexListRef.current.scrollLeft = 0
      }, [panorama])

      useEffect(() => {
        if (!indexVisible) setIndexPreviewId('')
      }, [indexVisible])

      useEffect(() => {
        setIndexPreviewId('')
      }, [indexQuery])

      useEffect(() => {
        const handleKey = (event) => {
          if (event.key !== 'Escape') return
          if (anchorEditor) { if (!anchorEditor.busy) { if (anchorEditor.refreshFailed) setAnchorMessage(tr('earthAnchorRefreshFailed')); setAnchorEditor(null) }; return }
          if (panorama) { setPanorama(false); return }
          if (indexVisible) { setIndexOpen(false); return }
          if (flight || landingRef.current) { returnToOrbit(); return }
          if (activeId) { onActive(''); setIndexOpen(true); return }
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
      }, [panorama, indexVisible, flight, activeId, onActive, anchorEditor, tr])

      // The landing detail is a card attached to the selected marker, not a
      // detached sidebar. Measure after the flight settles and keep it clear of
      // the stage edges; below 980px CSS turns the same card into a bottom sheet.
      useEffect(() => {
        if (!isLanding || !active) { setCardAnchor(null); return undefined }
        let raf = 0
        let timer = 0
        const update = () => {
          const stage = stageRef.current
          const marker = markerNodes.current[active.id]
          if (!stage || !marker) return
          const sr = stage.getBoundingClientRect()
          const mr = marker.getBoundingClientRect()
          if (sr.width < 2 || mr.width < 2) return
          const width = Math.min(348, Math.max(288, sr.width - 96))
          const pad = 18
          const gap = 26
          const leftCandidate = mr.left - sr.left - width - gap
          const side = leftCandidate >= pad ? 'left' : 'right'
          const left = side === 'left'
            ? leftCandidate
            : Math.min(sr.width - width - pad, Math.max(pad, mr.right - sr.left + gap))
          const top = Math.max(78, Math.min(sr.height - 180, mr.top - sr.top - 210))
          const maxHeight = Math.max(260, sr.height - top - 24)
          const tail = Math.max(28, Math.min(maxHeight - 28, mr.top - sr.top + mr.height / 2 - top))
          const next = { left, top, width, maxHeight, side, tail }
          setCardAnchor((prev) => (prev && prev.side === next.side && Math.abs(prev.left - next.left) < .6 && Math.abs(prev.top - next.top) < .6 && Math.abs(prev.width - next.width) < .6 && Math.abs(prev.maxHeight - next.maxHeight) < .6 && Math.abs(prev.tail - next.tail) < .6 ? prev : next))
        }
        raf = requestAnimationFrame(update)
        timer = window.setTimeout(update, 140)
        const poll = window.setInterval(update, 180)
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null
        if (observer && stageRef.current) observer.observe(stageRef.current)
        window.addEventListener('resize', update)
        return () => {
          cancelAnimationFrame(raf)
          window.clearTimeout(timer)
          window.clearInterval(poll)
          observer?.disconnect()
          window.removeEventListener('resize', update)
        }
      }, [isLanding, active?.id, landing?.at])

      useEffect(() => {
        const canvas = canvasRef.current
        const stage = stageRef.current
        if (!canvas || !stage) return undefined
        let gl = null
        let program = null
        let frame = 0
        let dead = false
        let observer = null
        const buffers = {}
        let textures = null
        const shader = {
          vertex: `attribute vec3 aPos; attribute vec2 aUv; attribute vec3 aNormal; uniform mat4 uProj; uniform mat4 uView; varying vec2 vUv; varying vec3 vWorld; varying vec3 vNormal; void main(){ vec4 world = vec4(aPos, 1.0); gl_Position = uProj * uView * world; vUv = aUv; vWorld = world.xyz; vNormal = aNormal; }`,
          fragment: `precision highp float; varying vec2 vUv; varying vec3 vWorld; varying vec3 vNormal; uniform sampler2D uDay; uniform sampler2D uNight; uniform sampler2D uBump; uniform vec3 uSun; uniform vec3 uCamera; uniform float uTerrainAssist; void main(){ vec3 n = normalize(vNormal); vec3 viewDir = normalize(uCamera - vWorld); float light = dot(n, normalize(uSun)); float day = smoothstep(-0.12, 0.22, light); vec3 dayColor = texture2D(uDay, vUv).rgb; vec3 nightColor = texture2D(uNight, vUv).rgb; float relief = texture2D(uBump, vUv).r; dayColor *= 0.86 + relief * 0.22; vec3 nightTerrain = mix(nightColor * 0.72, dayColor * vec3(0.70, 0.78, 0.90), uTerrainAssist); vec3 color = mix(nightTerrain, dayColor, day); float twilight = smoothstep(-0.20, 0.0, light) * (1.0 - smoothstep(0.0, 0.28, light)); color += vec3(0.34, 0.18, 0.08) * twilight * 0.22; float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 2.4); color += vec3(0.09, 0.22, 0.30) * rim * 0.52; gl_FragColor = vec4(color, 1.0); }`,
        }
        const resize = () => {
          if (!gl || dead) return
          const ratio = Math.min(2, window.devicePixelRatio || 1)
          const width = Math.max(2, Math.round(stage.clientWidth * ratio))
          const height = Math.max(2, Math.round(stage.clientHeight * ratio))
          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width
            canvas.height = height
          }
          gl.viewport(0, 0, width, height)
        }
        const setup = async () => {
          try {
            gl = canvas.getContext('webgl', { alpha: true, antialias: true, powerPreference: 'high-performance' })
            if (!gl) throw new Error('WebGL unavailable')
            const vertex = earthCompile(gl, gl.VERTEX_SHADER, shader.vertex)
            const fragment = earthCompile(gl, gl.FRAGMENT_SHADER, shader.fragment)
            program = gl.createProgram()
            gl.attachShader(program, vertex)
            gl.attachShader(program, fragment)
            gl.linkProgram(program)
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'program link failed')
            gl.deleteShader(vertex)
            gl.deleteShader(fragment)
            gl.useProgram(program)
            const sphere = earthSphere()
            buffers.position = gl.createBuffer()
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position)
            gl.bufferData(gl.ARRAY_BUFFER, sphere.positions, gl.STATIC_DRAW)
            buffers.uv = gl.createBuffer()
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.uv)
            gl.bufferData(gl.ARRAY_BUFFER, sphere.uvs, gl.STATIC_DRAW)
            buffers.index = gl.createBuffer()
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.index)
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphere.indices, gl.STATIC_DRAW)
            const day = await earthLoadTexture(gl, EARTH_DAY_URL)
            const night = await earthLoadTexture(gl, EARTH_NIGHT_URL)
            if (dead) return
            if (!day) {
              setFailure('texture')
              setStatus('fallback')
              return
            }
            textures = {
              day,
              night: night || earthFlatTexture(gl, [3, 7, 12, 255]),
              bump: earthFlatTexture(gl, [64, 64, 64, 255]),
            }
            gl.bindTexture(gl.TEXTURE_2D, textures.day)
            gl.uniform1i(gl.getUniformLocation(program, 'uDay'), 0)
            gl.activeTexture(gl.TEXTURE1)
            gl.bindTexture(gl.TEXTURE_2D, textures.night)
            gl.uniform1i(gl.getUniformLocation(program, 'uNight'), 1)
            gl.activeTexture(gl.TEXTURE2)
            gl.bindTexture(gl.TEXTURE_2D, textures.bump)
            gl.uniform1i(gl.getUniformLocation(program, 'uBump'), 2)
            gl.activeTexture(gl.TEXTURE0)
            gl.enable(gl.DEPTH_TEST)
            gl.clearColor(0, 0, 0, 0)
            const bindAttribute = (name, buffer, size) => {
              const location = gl.getAttribLocation(program, name)
              if (location < 0) return
              gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
              gl.enableVertexAttribArray(location)
              gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0)
            }
            bindAttribute('aPos', buffers.position, 3)
            bindAttribute('aUv', buffers.uv, 2)
            // The normal is the unit sphere direction, so it can share position.
            bindAttribute('aNormal', buffers.position, 3)
            const sun = earthSunVector()
            const s = stateRef.current
            if (!s.restored) {
              s.yaw = s.targetYaw = Math.atan2(sun[0], sun[2])
              s.pitch = s.targetPitch = Math.asin(Math.max(-1, Math.min(1, sun[1])))
            }
            resize()
            if (typeof ResizeObserver !== 'undefined') {
              observer = new ResizeObserver(resize)
              observer.observe(stage)
            } else {
              window.addEventListener('resize', resize)
            }
            setStatus('ready')
            let last = performance.now()
            const draw = (time) => {
              if (dead || !gl) return
              const dt = Math.min(0.05, Math.max(0, (time - last) / 1000))
              last = time
              const s = stateRef.current
              if (s.flight) {
                const f = s.flight
                f.t = Math.min(1, f.t + dt / Math.max(0.01, f.duration))
                const ease = f.t < 0.5 ? 4 * f.t * f.t * f.t : 1 - Math.pow(-2 * f.t + 2, 3) / 2
                if (f.fromCamera && f.toCamera) {
                  const mix = (a, b, k) => a + (b - a) * k
                  s.flightCamera = {
                    eye: earthFlightEye(f.fromCamera.eye, f.toCamera.eye, ease),
                    target: f.fromCamera.target.map((value, index) => mix(value, f.toCamera.target[index], ease)),
                  }
                }
                if (f.t >= 1) {
                  s.cameraOverride = f.toCamera || null
                  s.flightCamera = null
                  s.flight = null
                  if (f.type === 'in') {
                    // Every route stops at the same inspectable landing. Opening
                    // the project is a separate, explicit user action.
                    s.cameraOverride = f.toCamera || s.cameraOverride
                    s.flightCamera = null
                    setFlight(null)
                    setLanding({ project: f.project, returnTo: f.returnTo, at: Date.now() })
                    onActive(f.project.id)
                  } else {
                    if (f.returnTo) {
                      s.yaw = s.targetYaw = f.returnTo.yaw
                      s.pitch = s.targetPitch = f.returnTo.pitch
                      s.distance = s.targetDistance = f.returnTo.distance
                    }
                    s.cameraOverride = null
                    setFlight(null)
                    finishEarthReturn(f, { onActive, setIndexOpen, setIndexPreviewId })
                  }
                }
              } else if (s.dragging) {
                // Pointer movement writes the view directly; do not ease away from the finger.
              } else if (s.playing) {
                s.yaw += dt * 0.006
                s.targetYaw = s.yaw
              } else {
                const ease = Math.min(1, dt * 4.2)
                s.yaw += Math.atan2(Math.sin(s.targetYaw - s.yaw), Math.cos(s.targetYaw - s.yaw)) * ease
                s.pitch += (s.targetPitch - s.pitch) * ease
                s.distance += (s.targetDistance - s.distance) * ease
              }
              const width = canvas.width
              const height = canvas.height
              const camera = s.flightCamera || s.cameraOverride || {
                eye: earthOrbitEye(s),
                target: [0, 0, 0],
              }
              const eye = camera.eye
              const view = earthLookAt(eye, camera.target)
              const projection = earthPerspective(34 * EARTH_RAD, width / Math.max(1, height), 0.05, 20)
              gl.viewport(0, 0, width, height)
              gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
              gl.useProgram(program)
              gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uProj'), false, projection)
              gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uView'), false, view)
              const sun = earthSunVector()
              gl.uniform3fv(gl.getUniformLocation(program, 'uSun'), sun)
              gl.uniform3fv(gl.getUniformLocation(program, 'uCamera'), eye)
              gl.uniform1f(gl.getUniformLocation(program, 'uTerrainAssist'), earthTerrainAssist(eye))
              gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.index)
              gl.drawElements(gl.TRIANGLES, sphere.indices.length, gl.UNSIGNED_SHORT, 0)
              s.camera = { eye, target: camera.target, view, projection, width, height }
              const markerLayer = markerNodes.current
              const markerViewport = earthMarkerViewport(canvas)
              const visibleMarkers = []
              for (const model of modelsRef.current) {
                const node = markerLayer[model.id]
                if (!node) continue
                const lat = model.lat * EARTH_RAD
                const lon = model.lon * EARTH_RAD
                const point = [Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon)]
                const eyeLength = Math.hypot(...eye) || 1
                const facing = (point[0] * eye[0] + point[1] * eye[1] + point[2] * eye[2]) / eyeLength
                // WebGL's backing buffer can be 2× the CSS size on phones and
                // high-DPI displays. Marker transforms use CSS pixels.
                const screen = earthPointVisible(point, eye)
                  ? earthProjectPoint(point, view, projection, markerViewport.width, markerViewport.height)
                  : null
                if (!screen) {
                  node.style.opacity = '0'
                  node.style.pointerEvents = 'none'
                  continue
                }
                node.style.opacity = String(Math.min(1, 0.36 + facing * 0.9))
                node.style.pointerEvents = 'auto'
                // Center the painted dot, not the top-left of its padded hit
                // target, on the projected surface location.
                node.style.transform = 'translate3d(' + screen.x + 'px, ' + screen.y + 'px, 0) translate(-11px, -50%)'
                node.style.zIndex = String(2 + Math.round(facing * 20))
                node.classList.toggle('is-active', model.id === activeIdRef.current)
                visibleMarkers.push({ model, node, screen })
              }
              // Keep the selected label first; place the rest without overlap. Unlabelled
              // markers stay dots, so a crowded hemisphere reads as a map, not a word cloud.
              const placedLabels = []
              const orderedMarkers = visibleMarkers.filter((item) => item.model.id === activeIdRef.current)
                .concat(visibleMarkers.filter((item) => item.model.id !== activeIdRef.current))
              for (const item of orderedMarkers) {
                item.node.classList.remove('is-label-up', 'is-label-down')
                const wanted = Boolean(item.model.label || item.model.id === activeIdRef.current)
                if (!wanted) { item.node.classList.remove('is-labeled'); continue }
                const text = item.model.project.displayName || item.model.project.name || ''
                const textWidth = Array.from(text).reduce((sum, char) => sum + (/[㐀-鿿]/.test(char) ? 11 : 6.4), 0)
                const maxWidth = item.model.id === activeIdRef.current ? 190 : 145
                const labelWidth = Math.min(maxWidth, textWidth) + 28
                const offsets = item.model.id === activeIdRef.current ? [0] : [0, -20, 20, -40, 40]
                let placed = false
                for (const offset of offsets) {
                  const box = { left: item.screen.x, top: item.screen.y + offset, right: item.screen.x + labelWidth, bottom: item.screen.y + offset + 18 }
                  const collides = placedLabels.some((other) => box.left < other.right + 4 && box.right + 4 > other.left && box.top < other.bottom + 2 && box.bottom + 2 > other.top)
                  if (collides) continue
                  item.node.classList.add('is-labeled')
                  if (offset < 0) item.node.classList.add('is-label-up')
                  else if (offset > 0) item.node.classList.add('is-label-down')
                  placedLabels.push(box); placed = true; break
                }
                if (!placed) item.node.classList.remove('is-labeled')
              }
              frame = requestAnimationFrame(draw)
            }
            frame = requestAnimationFrame(draw)
          } catch (error) {
            if (!dead) {
              setFailure(String(error?.message || error))
              setStatus('fallback')
            }
          }
        }
        setup()
        return () => {
          dead = true
          cancelAnimationFrame(frame)
          observer?.disconnect()
          window.removeEventListener('resize', resize)
          if (gl) {
            if (textures) Object.values(textures).forEach((texture) => gl.deleteTexture(texture))
            Object.values(buffers).forEach((buffer) => gl.deleteBuffer(buffer))
            if (program) gl.deleteProgram(program)
          }
        }
      }, [])

      useEffect(() => {
        if (status !== 'ready' || activeId || orbitRestoreRef.current) return
        orbitRestoreRef.current = true
        let snapshot = null
        try { snapshot = JSON.parse(sessionStorage.getItem(EARTH_RETURN_KEY) || 'null') } catch { snapshot = null }
        if (!snapshot || snapshot.mode !== 'orbit' || Date.now() - Number(snapshot.at || 0) > 86400000) return
        const s = stateRef.current
        const yaw = Number(snapshot.yaw)
        const pitch = Number(snapshot.pitch)
        const distance = Number(snapshot.distance)
        s.restored = true
        s.yaw = s.targetYaw = Number.isFinite(yaw) ? yaw : s.yaw
        s.pitch = s.targetPitch = Number.isFinite(pitch) ? pitch : s.pitch
        s.distance = s.targetDistance = Number.isFinite(distance) && distance > 0 ? distance : earthOrbitDistance()
        s.cameraOverride = null
        s.flightCamera = null
        s.flight = null
        s.dragging = false
        s.playing = false
        setPlaying(false)
        setFlight(null)
        setLanding(null)
        setIndexOpen(true)
        setIndexQuery(typeof snapshot.query === 'string' ? snapshot.query : '')
        try { sessionStorage.removeItem(EARTH_RETURN_KEY) } catch { /* storage is optional */ }
      }, [status, activeId])

      useEffect(() => {
        if (status !== 'ready' || !activeId) return
        let snapshot = null
        try { snapshot = JSON.parse(sessionStorage.getItem(EARTH_RETURN_KEY) || 'null') } catch { snapshot = null }
        if (!snapshot || snapshot.projectId !== activeId || Date.now() - Number(snapshot.at || 0) > 86400000) return
        const model = models.find((item) => item.id === activeId)
        if (!model) return
        const s = stateRef.current
        s.restored = true
        const returnTo = {
          yaw: Number(snapshot.yaw) || s.yaw,
          pitch: Number(snapshot.pitch) || s.pitch,
          distance: Number(snapshot.distance) || earthOrbitDistance(),
        }
        const camera = snapshot.camera
        if (snapshot.mode === 'landing' && camera && Array.isArray(camera.eye) && Array.isArray(camera.target)) {
          s.yaw = s.targetYaw = returnTo.yaw
          s.pitch = s.targetPitch = returnTo.pitch
          s.distance = s.targetDistance = returnTo.distance
          s.cameraOverride = { eye: camera.eye.map(Number), target: camera.target.map(Number) }
          s.flightCamera = null
          s.flight = null
          s.playing = false
          s.dragging = false
          setPlaying(false)
          setFlight(null)
          setLanding({ project: model.project, returnTo, at: Number(snapshot.at) || Date.now() })
          setIndexQuery(typeof snapshot.query === 'string' ? snapshot.query : '')
          try { sessionStorage.removeItem(EARTH_RETURN_KEY) } catch { /* storage is optional */ }
          return
        }
        const surface = earthApproachCamera(model)
        s.yaw = s.targetYaw = returnTo.yaw
        s.pitch = s.targetPitch = returnTo.pitch
        s.distance = s.targetDistance = returnTo.distance
        s.cameraOverride = null
        s.flightCamera = null
        s.playing = false
        setPlaying(false)
        s.flight = {
          type: 'out', project: model.project, t: 0, duration: earthReduced() ? 0.01 : 1.1,
          fromCamera: surface,
          toCamera: { eye: earthOrbitEye(returnTo), target: [0, 0, 0] },
          returnTo,
        }
        setLanding(null)
        setFlight({ phase: 'returning', project: model.project })
        try { sessionStorage.removeItem(EARTH_RETURN_KEY) } catch { /* storage is optional */ }
      }, [status, activeId, models])

      const chooseRepresentative = async (item) => {
        if (!active) return { ok: false, error: tr('earthMediaFailed') }
        try {
          const response = await fetch(API + '/override', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              id: active.id,
              patch: { representativeImage: item ? { path: item.path, folder: item.folder, title: item.title } : null },
            }),
          })
          const data = await response.json().catch(() => ({}))
          if (!response.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + response.status))
          invalidateProjectMedia(active.id)
          await activeMedia.reload()
          onRefresh?.()
          return { ok: true }
        } catch (error) { return { ok: false, error: error?.message || String(error) } }
      }

      const startFlight = (project) => {
        if (!project) return
        const s = stateRef.current
        if (s.flight || landingRef.current) return
        const model = models.find((item) => item.id === project.id)
        if (!model) return
        setIndexOpen(false)
        // Panorama deliberately hides the inspector; leave it before landing
        // so that project information and the explicit entry remain available.
        setPanorama(false)
        const returnTo = { yaw: s.yaw, pitch: s.pitch, distance: s.distance }
        s.cameraOverride = null
        s.flightCamera = null
        s.flight = {
          type: 'in', project, t: 0, duration: earthReduced() ? 0.01 : 1.35,
          fromCamera: {
            eye: s.camera?.eye || earthOrbitEye(s),
            target: s.camera?.target || [0, 0, 0],
          },
          toCamera: earthApproachCamera(model),
          returnTo,
        }
        s.playing = false
        setPlaying(false)
        onActive(project.id)
        setFlight({ phase: 'flying', project, returnTo })
      }

      const enterProjectFromLanding = (tab) => {
        const current = landingRef.current
        if (!current) return
        const s = stateRef.current
        const camera = s.cameraOverride || s.camera
        const snapshot = {
          projectId: current.project.id,
          mode: 'landing',
          camera: camera ? { eye: [...camera.eye], target: [...camera.target] } : null,
          yaw: current.returnTo?.yaw,
          pitch: current.returnTo?.pitch,
          distance: current.returnTo?.distance,
          query: indexQueryRef.current,
          at: Date.now(),
        }
        try { sessionStorage.setItem(EARTH_RETURN_KEY, JSON.stringify(snapshot)) } catch { /* storage is optional */ }
        onOpen(current.project, tab)
      }

      const openFromEarth = (project, tab) => {
        if (project && landingRef.current?.project?.id === project.id) return enterProjectFromLanding(tab)
        return onOpen(project, tab)
      }

      const returnToOrbit = (options = {}) => {
        const currentLanding = landingRef.current
        if (!flight && !currentLanding) return
        const s = stateRef.current
        const project = flight?.project || currentLanding.project
        const returnTo = flight?.returnTo || currentLanding.returnTo || { yaw: s.yaw, pitch: s.pitch, distance: earthOrbitDistance() }
        s.cameraOverride = null
        s.flightCamera = null
        s.flight = {
          type: 'out', project, t: 0, duration: earthReduced() ? 0.01 : 1.15, preserveSelection: options?.preserveSelection === true,
          fromCamera: {
            eye: s.camera?.eye || earthOrbitEye(s),
            target: s.camera?.target || [0, 0, 0],
          },
          toCamera: { eye: earthOrbitEye(returnTo), target: [0, 0, 0] },
          returnTo,
        }
        s.playing = false
        setPlaying(false)
        setLanding(null)
        setFlight({ phase: 'returning', project, returnTo })
      }
      returnToOrbitRef.current = returnToOrbit

      const beginAnchorEdit = () => {
        if (!activeModel || flight) return
        if (landingRef.current) returnToOrbit({ preserveSelection: true })
        setIndexOpen(false)
        setPlaying(false)
        stateRef.current.playing = false
        setAnchorMessage('')
        setAnchorEditor({ projectId: activeModel.id, projectName: activeModel.project.displayName || activeModel.project.name,
          lat: String(Number(activeModel.lat.toFixed(5))), lon: String(Number(activeModel.lon.toFixed(5))), picking: false, busy: false, error: '' })
      }

      const saveEarthAnchor = async (reset = false) => {
        if (!anchorEditor || anchorEditor.busy || anchorEditor.refreshFailed) return
        const coords = reset ? null : parseEarthAnchorDraft(anchorEditor.lat, anchorEditor.lon)
        if (!reset && !coords) { setAnchorEditor((prev) => prev && { ...prev, error: tr('earthAnchorInvalid') }); return }
        const projectId = anchorEditor.projectId
        setAnchorEditor((prev) => prev && { ...prev, busy: true, picking: false, error: '' })
        try {
          const refreshed = await saveAndRefreshEarthAnchor(projectId, coords, onRefresh)
          if (!refreshed) {
            setAnchorEditor((prev) => prev?.projectId === projectId ? { ...prev, busy: false, refreshFailed: true, error: tr('earthAnchorRefreshFailed') } : prev)
            return
          }
          setAnchorEditor((prev) => prev?.projectId === projectId ? null : prev)
          setAnchorMessage(tr('earthAnchorSaved'))
        } catch (error) {
          setAnchorEditor((prev) => prev?.projectId === projectId ? { ...prev, busy: false, error: `${tr('earthAnchorSaveFailed')}: ${error?.message || error}` } : prev)
        }
      }

      const retryEarthAnchorRefresh = async () => {
        if (!anchorEditor?.refreshFailed || anchorEditor.busy) return
        const projectId = anchorEditor.projectId
        setAnchorEditor((prev) => prev && { ...prev, busy: true })
        const refreshed = await refreshEarthAnchor(onRefresh)
        if (refreshed) {
          setAnchorEditor((prev) => prev?.projectId === projectId ? null : prev)
          setAnchorMessage(tr('earthAnchorSaved'))
        } else {
          setAnchorEditor((prev) => prev?.projectId === projectId ? { ...prev, busy: false, error: tr('earthAnchorRefreshFailed') } : prev)
        }
      }

      const zoomBy = (delta) => {
        const s = stateRef.current
        if (s.flight || s.cameraOverride) return
        s.targetDistance = Math.max(1.52, Math.min(8, (s.targetDistance || s.distance) + delta))
        s.playing = false
        setPlaying(false)
      }

      const togglePlay = () => {
        if (flight || stateRef.current.cameraOverride) return
        const next = !playing
        setPlaying(next)
        stateRef.current.playing = next
      }

      const togglePanorama = () => {
        if (anchorEditor) return
        if (panorama) { setPanorama(false); return }
        if (flight) return
        if (landingRef.current) {
          onActive('')
          returnToOrbit()
        }
        setIndexOpen(true)
        setPanorama(true)
      }

      const handleStageDoubleClick = (event) => {
        if (anchorEditor) return
        const target = event.target
        if (target instanceof Element && target.closest('button,a,input,textarea,select,.wb-earth-marker,.wb-earth-inspector,.wb-earth-index,.wb-earth-top,.wb-earth-zoombar,.wb-earth-bottom,.wb-earth-restore')) return
        event.preventDefault()
        togglePanorama()
      }

      const showIndex = () => {
        if (anchorEditor) return
        if (flight) return
        if (landingRef.current) { setIndexOpen(true); returnToOrbit(); return }
        if (activeId) {
          onActive('')
          setIndexOpen(true)
          return
        }
        setIndexOpen((open) => !open)
      }

      const enterFromIndex = (model) => {
        if (anchorEditor) return
        if (!model?.project) return
        if (flight || landingRef.current) return
        // Index and globe markers both stop at the inspectable project landing.
        if (!models.some((item) => item.id === model.project.id)) return
        startFlight(model.project)
      }

      const openMarker = (project) => {
        if (anchorEditor) return
        startFlight(project)
      }

      const pointerDown = (event) => {
        if (event.button !== 0 || flight || stateRef.current.cameraOverride) return
        const canvas = canvasRef.current
        canvas?.setPointerCapture?.(event.pointerId)
        if (anchorEditor?.picking && !anchorEditor.busy) {
          anchorPointerRef.current = touchPointsRef.current.size ? null : { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false }
        }
        if (event.pointerType === 'touch') {
          const points = touchPointsRef.current
          if (points.size >= 2) return
          points.set(event.pointerId, { x: event.clientX, y: event.clientY })
          if (points.size === 2) {
            const [a, b] = [...points.values()]
            pinchRef.current = { span: Math.hypot(a.x - b.x, a.y - b.y), distance: stateRef.current.targetDistance || stateRef.current.distance }
            dragRef.current = null
            stateRef.current.dragging = true
            setPlaying(false)
            return
          }
        }
        dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw: stateRef.current.yaw, pitch: stateRef.current.pitch }
        stateRef.current.dragging = true
        setPlaying(false)
      }
      const pointerMove = (event) => {
        const pick = anchorPointerRef.current
        if (pick && pick.id === event.pointerId && Math.hypot(event.clientX - pick.x, event.clientY - pick.y) > 8) pick.moved = true
        const points = touchPointsRef.current
        if (event.pointerType === 'touch' && points.has(event.pointerId)) {
          points.set(event.pointerId, { x: event.clientX, y: event.clientY })
          if (pinchRef.current && points.size === 2) {
            const [a, b] = [...points.values()]
            const nextDistance = earthPinchDistance(pinchRef.current.distance, pinchRef.current.span, Math.hypot(a.x - b.x, a.y - b.y))
            stateRef.current.distance = stateRef.current.targetDistance = nextDistance
            return
          }
        }
        const drag = dragRef.current
        if (!drag || drag.id !== event.pointerId) return
        const s = stateRef.current
        s.yaw = drag.yaw - (event.clientX - drag.x) * 0.005
        s.pitch = Math.max(-1.32, Math.min(1.32, drag.pitch + (event.clientY - drag.y) * 0.004))
        s.targetYaw = s.yaw
        s.targetPitch = s.pitch
      }
      const pointerUp = (event) => {
        const pick = anchorPointerRef.current
        if (pick && pick.id === event.pointerId) {
          anchorPointerRef.current = null
          if (anchorEditor?.picking && !pick.moved && event.type !== 'pointercancel') {
            const coords = earthPickCoords(event.clientX, event.clientY, canvasRef.current?.getBoundingClientRect(), stateRef.current.camera)
            if (coords) setAnchorEditor((prev) => prev && { ...prev, lat: String(Number(coords.lat.toFixed(5))), lon: String(Number(coords.lon.toFixed(5))), picking: false, error: '' })
            else setAnchorEditor((prev) => prev && { ...prev, error: tr('earthAnchorPickMiss') })
          }
        }
        if (event.pointerType === 'touch' && touchPointsRef.current.has(event.pointerId)) {
          touchPointsRef.current.delete(event.pointerId)
          pinchRef.current = null
          if (touchPointsRef.current.size === 1) {
            const [id, point] = [...touchPointsRef.current.entries()][0]
            dragRef.current = { id, x: point.x, y: point.y, yaw: stateRef.current.yaw, pitch: stateRef.current.pitch }
            return
          }
        }
        if (dragRef.current?.id !== event.pointerId) return
        dragRef.current = null
        stateRef.current.dragging = false
      }
      const wheel = (event) => {
        event.preventDefault()
        if (landingRef.current) {
          if (event.deltaY !== 0) returnToOrbitRef.current?.()
          return
        }
        zoomBy(Math.sign(event.deltaY) * 0.24)
      }

      useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return undefined
        canvas.addEventListener('wheel', wheel, { passive: false })
        return () => canvas.removeEventListener('wheel', wheel)
      }, [])
      useEffect(() => {
        if (!landing) return undefined
        const stage = stageRef.current
        if (!stage) return undefined
        const onWheel = (event) => {
          if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
          if (event.deltaY === 0) return
          if (event.target === canvasRef.current) return
          if (event.target instanceof Element && event.target.closest('.wb-earth-inspector,[role="dialog"]')) return
          event.preventDefault()
          returnToOrbitRef.current?.()
        }
        stage.addEventListener('wheel', onWheel, { passive: false })
        return () => stage.removeEventListener('wheel', onWheel)
      }, [landing])

      const filteredIndex = useMemo(() => {
        const needle = indexQuery.trim().toLowerCase()
        return models.filter((model) => !needle || `${model.project.displayName || model.project.name} ${model.project.path} ${model.project.note || ''}`.toLowerCase().includes(needle))
      }, [models, indexQuery])

      if (status === 'fallback') {
        return h('div', { className: 'wb-earth-fallback' },
          h('div', { className: 'wb-earth-fallback-head' },
            h(Glyph, { name: 'globe', size: 20 }),
            h('div', null,
              h('b', null, tr('earthFallbackTitle')),
              h('p', null, failure === 'texture' ? tr('earthTextureFailed') : tr('earthWebglFailed')))),
          h(ProjectDeck, { items: projects, activeId, onActive, onSelect: onOpen, tr }))
      }

      return h('div', { className: cx('wb-earth', 'wb-scene-enter', panorama && 'is-panorama', indexVisible && !panorama && 'is-index-open', flight && 'is-flight', landing && 'is-landing', anchorEditor && 'is-anchor-editing', anchorEditor?.picking && 'is-anchor-picking') },
        h('div', { ref: stageRef, className: cx('wb-earth-stage', panorama && 'is-panorama', active && 'is-active', flight && 'is-flight', landing && 'is-landing'), onDoubleClick: handleStageDoubleClick },
          h('div', { className: 'wb-earth-stars', 'aria-hidden': true }),
          anchorEditor ? h('div', { ref: anchorPreviewRef, className: 'wb-earth-anchor-preview', style: { opacity: 0 }, 'aria-hidden': true }, tr('earthAnchorPreview')) : null,
          h('canvas', {
            ref: canvasRef, className: 'wb-earth-canvas', role: 'img',
            'aria-label': tr('earthCanvasLabel'),
            onPointerDown: pointerDown, onPointerMove: pointerMove, onPointerUp: pointerUp, onPointerCancel: pointerUp,
          }),
          h('div', { className: 'wb-earth-markers', 'aria-hidden': false },
            models.map((model) => h('button', {
              key: model.id, type: 'button', ref: (node) => { if (node) markerNodes.current[model.id] = node; else delete markerNodes.current[model.id] },
              className: cx('wb-earth-marker', model.id === activeId && 'is-active', model.id === indexPreviewId && 'is-preview'),
              style: { opacity: 0 }, title: `${model.project.displayName || model.project.name} · ${tr('earthLayoutNote')}`,
              'data-project-id': model.id, 'aria-label': `${model.project.displayName || model.project.name} · ${tr('earthOpenHint')}`,
              onClick: () => openMarker(model.project),
              onKeyDown: (event) => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openMarker(model.project) }
              },
            },
              h('i', { className: 'wb-earth-dot' }),
              h('span', { className: 'wb-earth-label' }, model.project.displayName || model.project.name))),
          ),
          h('div', { className: 'wb-earth-top' },
            h('div', { className: 'wb-earth-brand' },
              h('span', { className: 'wb-earth-mark' }, h(Glyph, { name: 'globe', size: 18 })),
              h('span', null, tr('earthTitle')),
              h('span', { className: 'wb-earth-divider' }),
              h('span', { className: 'wb-earth-caption' }, tr('earthSubtitle'))),
            h('div', { className: 'wb-earth-actions' },
              h('span', { className: 'wb-earth-clock' }, new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(clock)),
              h('button', { type: 'button', className: cx('wb-earth-control', playing && 'is-on'), onClick: togglePlay, 'aria-pressed': playing, 'aria-label': tr('earthPlayHint'), title: tr('earthPlayHint') }, playing ? 'Ⅱ' : '▶'),
              !panorama ? h('button', { type: 'button', className: cx('wb-earth-control', indexOpen && 'is-on'), onClick: showIndex, 'aria-expanded': indexVisible }, tr('earthIndex'), ' ', h('span', null, String(projects.length))) : null,
              h('button', { type: 'button', className: cx('wb-earth-control', panorama && 'is-on'), onClick: togglePanorama, 'aria-pressed': panorama }, tr('earthPanorama'), ' ⤢'))),
          h('div', { className: 'wb-earth-intro' },
            h('div', { className: 'wb-earth-overline' }, tr('earthOverline')),
            h('h1', null, tr('earthHeadline')),
            h('p', null, tr('earthIntro'))),
          indexVisible ? h('section', { className: cx('wb-earth-index', 'is-deck', panorama && 'is-focus'), 'aria-label': panorama ? tr('earthIndexFullscreen') : tr('earthIndex') },
            h('div', { className: 'wb-earth-index-head' },
              h('div', { className: 'wb-earth-index-heading' },
                h('b', null, panorama ? tr('earthIndexFullscreen') : tr('earthIndex')),
                h('span', null, `${filteredIndex.length} / ${projects.length} ${tr('projects')}`)),
              h('span', { className: 'wb-earth-index-hint' }, panorama ? tr('earthFocusExitHint') : tr('earthFocusHint')),
              h('button', { type: 'button', className: 'wb-earth-close', onClick: () => { if (panorama) togglePanorama(); else setIndexOpen(false) }, 'aria-label': tr('close') }, '×')),
            h('input', { className: 'wb-earth-search', value: indexQuery, onChange: (event) => setIndexQuery(event.target.value), placeholder: tr('earthSearch') }),
            h('div', { ref: indexListRef, className: 'wb-earth-index-list', onWheel: (event) => {
              if (!panorama || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
              event.currentTarget.scrollLeft += event.deltaY
            } },
              filteredIndex.length ? filteredIndex.map((model) => h('button', {
                key: model.id, type: 'button',
                className: cx('wb-earth-project-card', `is-${model.project.lifecycle || 'unclassified'}`, model.id === activeId && 'is-active'),
                onClick: () => enterFromIndex(model),
                onMouseEnter: () => setIndexPreviewId(model.id),
                onMouseLeave: () => setIndexPreviewId((current) => current === model.id ? '' : current),
                onFocus: () => setIndexPreviewId(model.id),
                onBlur: () => setIndexPreviewId((current) => current === model.id ? '' : current),
                title: `${model.project.displayName || model.project.name} · ${model.project.path || '—'}`,
                'aria-label': `${tr('earthIndexEnter')}: ${model.project.displayName || model.project.name}`,
              },
                h('span', { className: 'wb-earth-project-card-top' },
                  h('span', { className: 'wb-earth-project-card-no' }, String(model.index + 1).padStart(2, '0')),
                  h('span', { className: 'wb-earth-project-card-life' }, lifecycleLabel(model.project.lifecycle, tr))),
                h('strong', { className: 'wb-earth-project-card-name' }, model.project.displayName || model.project.name),
                h('span', { className: 'wb-earth-project-card-path' }, model.project.path || '—'),
                h('span', { className: 'wb-earth-project-card-foot' },
                  h('span', null, `${statusLabel(model.project.status, tr)} · ${model.project.sessionCount || 0} ${tr('sessions')}`),
                  h('b', null, tr('earthIndexEnter'), ' ↗')))) : h('p', { className: 'wb-earth-index-empty' }, tr('earthNoMatch')))) : null,
          active ? h('aside', {
            className: cx('wb-earth-inspector', isLanding && 'is-map-card'),
            'data-card-side': isLanding ? cardAnchor?.side : undefined,
            style: isLanding && cardAnchor ? {
              left: `${cardAnchor.left}px`,
              top: `${cardAnchor.top}px`,
              width: `${cardAnchor.width}px`,
              maxHeight: `${cardAnchor.maxHeight}px`,
              '--wb-card-tail': `${cardAnchor.tail}px`,
            } : undefined,
            'aria-live': 'polite',
          },
            h('span', { className: 'wb-earth-card-tail', 'aria-hidden': 'true' }),
            h('div', { className: 'wb-earth-card-head' },
              h('div', { className: 'wb-earth-overline' }, isLanding ? tr('earthLandingKicker') : tr('earthAnchorKicker')),
              isLanding ? h('button', { type: 'button', className: 'wb-earth-card-close', onClick: returnToOrbit, 'aria-label': tr('close'), title: tr('earthLandingReturn') }, '×') : null),
            h('h2', { 'data-wb-morph-title': '1' }, active.displayName || active.name),
            h('p', { className: 'wb-earth-path', title: active.path }, active.path),
            h('div', { className: 'wb-earth-facts' },
              h('span', { className: cx('wb-earth-fact', 'is-life', active.lifecycle) }, lifecycleLabel(active.lifecycle, tr)),
              h('span', { className: 'wb-earth-fact' }, statusLabel(active.status, tr)),
              h('span', { className: 'wb-earth-fact' }, `${active.sessionCount || 0} ${tr('sessions')}`),
              h('span', { className: 'wb-earth-fact' }, `${active.folderCount || 1} ${tr('projectFolders')}`)),
            isLanding ? h('div', { className: 'wb-earth-card-actions' },
              h('button', { type: 'button', className: 'wb-btn primary', onClick: () => enterProjectFromLanding('overview') }, tr('earthLandingEnter'), ' ↗'),
              h('button', { type: 'button', className: 'wb-btn ghost', onClick: returnToOrbit }, tr('earthLandingReturn')),
              h('button', { type: 'button', className: 'wb-btn', onClick: beginAnchorEdit }, tr('earthAnchorEdit')),
              h('span', { className: 'wb-earth-card-hint' }, tr('earthLandingWheelHint'))) : null,
            h(ProjectMediaAnchor, { project: active, media: activeMedia, tr, onOpen: openFromEarth, onChoose: () => setMediaPicker(true) }),
            h('div', { className: 'wb-anchor-record' },
              h('span', null, tr('earthRecentRecord')),
              h('b', null, active.lastActivity ? `${fmtDate(active.lastActivity)} · ${relTime(active.lastActivity, tr)}` : tr('earthNoRecord')),
              h('small', null, tr('earthRecordHint'))),
            h('p', { className: 'wb-earth-note' }, active.note || active.summary || tr('earthNoNote')),
            h('div', { className: 'wb-anchor-links' },
              h('button', { type: 'button', onClick: () => openFromEarth(active, 'overview') }, tr('earthAnchorOpen')),
              h('button', { type: 'button', onClick: () => openFromEarth(active, 'capability') }, tr('earthAnchorCapability')),
              h('button', { type: 'button', onClick: () => openFromEarth(active, 'outputs') }, tr('earthAnchorOutputs')),
              h('button', { type: 'button', onClick: () => openFromEarth(active, 'sessions') }, tr('earthAnchorSessions')),
              active.path ? h('button', { type: 'button', onClick: () => onOpenPath?.(active.path) }, tr('earthAnchorFolder')) : null),
            isLanding ? null : h('div', { className: 'wb-earth-actions-row' },
              h(React.Fragment, null,
                h('button', { type: 'button', className: 'wb-btn primary', onClick: () => startFlight(active) }, tr('earthEnter'), ' ↗'),
                h('button', { type: 'button', className: 'wb-btn ghost', onClick: () => openFromEarth(active) }, tr('earthOpenRoom')),
                h('button', { type: 'button', className: 'wb-btn', onClick: beginAnchorEdit }, tr('earthAnchorEdit')))),
            h('p', { className: 'wb-earth-disclaimer' }, tr('earthLayoutNote'))) : !indexVisible ? h('aside', { className: 'wb-earth-inspector is-empty' },
            h('div', { className: 'wb-earth-overline' }, tr('earthProjectOverline')),
            h('p', { className: 'wb-earth-empty-copy' },
              h('span', { className: 'wb-earth-hint-desktop' }, tr('earthSelectHint')),
              h('span', { className: 'wb-earth-hint-touch' }, tr('earthTouchSelectHint')))) : null,
          mediaPicker && active ? h(ProjectMediaPicker, { project: active, tr, onClose: () => setMediaPicker(false), onApply: chooseRepresentative }) : null,
          anchorEditor ? h(EarthAnchorEditor, {
            editor: anchorEditor, tr,
            onChange: (key, value) => setAnchorEditor((prev) => prev && { ...prev, [key]: value, picking: false, error: '' }),
            onPick: () => setAnchorEditor((prev) => prev && { ...prev, picking: !prev.picking, error: '' }),
            onSave: () => saveEarthAnchor(false), onReset: () => saveEarthAnchor(true), onRetryRefresh: retryEarthAnchorRefresh,
            onCancel: () => { if (anchorEditor.refreshFailed) setAnchorMessage(tr('earthAnchorRefreshFailed')); setAnchorEditor(null) },
          }) : null,
          anchorMessage ? h('div', { className: 'wb-earth-landing-note', role: 'status' }, anchorMessage) : null,
          landing ? h('div', { className: 'wb-earth-landing-note', role: 'status' },
            h('span', { className: 'wb-earth-landing-dot' }),
            h('div', null,
              h('b', null, tr('earthLandingLabel')),
              h('span', null, landing.project.displayName || landing.project.name),
              h('small', null, tr('earthLandingHint')))) : null,
          h('div', { className: 'wb-earth-zoombar' },
            h('button', { type: 'button', onClick: () => zoomBy(0.28), 'aria-label': tr('earthZoomOut') }, '−'),
            h('button', { type: 'button', onClick: () => zoomBy(-0.28), 'aria-label': tr('earthZoomIn') }, '+')),
          h('div', { className: 'wb-earth-bottom' },
            h('span', null, h('i', { className: 'wb-earth-live-dot' }), tr('earthDayNight')),
            isLanding ? h('span', null, tr('earthTerrainAssist')) : null,
            h('span', { className: 'wb-earth-hint-desktop' }, tr('earthDragHint')),
            h('span', { className: 'wb-earth-hint-touch' }, tr('earthTouchHint')),
            h('span', { className: 'wb-earth-focus-hint' }, tr('earthFocusHint'))),
          flight?.phase === 'flying' ? h('div', { className: 'wb-earth-flight' }, h('span', { className: 'wb-earth-flight-dot' }), tr('earthFlying', { name: flight.project.displayName || flight.project.name })) : null,
          panorama ? h('button', { type: 'button', className: 'wb-earth-restore', onClick: () => setPanorama(false) },
            h('span', { className: 'wb-earth-hint-desktop' }, tr('earthExitPanorama')),
            h('span', { className: 'wb-earth-hint-touch' }, tr('earthTouchExitPanorama')), ' ⤡') : null),
        h('div', { className: 'wb-earth-credit' }, tr('earthCredit')))
    }

    const TIME_BUCKETS = [
      { id: 'all', labelKey: 'sceneTimeAll' },
      { id: 'today', labelKey: 'sceneTimeToday' },
      { id: 'week', labelKey: 'sceneTimeWeek' },
      { id: 'month', labelKey: 'sceneTimeMonth' },
      { id: 'quarter', labelKey: 'sceneTimeQuarter' },
      { id: 'year', labelKey: 'sceneTimeYear' },
      { id: 'older', labelKey: 'sceneTimeOlder' },
      { id: 'unknown', labelKey: 'sceneTimeUnknown' },
    ]

    const projectTime = (project) => {
      // Only activity evidence belongs on the time axis. A created date is
      // shown separately in the ledger, never promoted to “last activity”.
      for (const value of [project?.lastActivity, project?.updatedAt]) {
        const time = Date.parse(value || '')
        if (Number.isFinite(time)) return time
      }
      return 0
    }

    const timeBucketFor = (time, now = Date.now()) => {
      if (!time) return 'unknown'
      const days = Math.max(0, (now - time) / 86400000)
      if (days < 1) return 'today'
      if (days < 7) return 'week'
      if (days < 30) return 'month'
      if (days < 90) return 'quarter'
      if (days < 365) return 'year'
      return 'older'
    }

    function TimeSpiral({ rows, activeId, onActive, onEnter, tr }) {
      const turns = rows.length > 34 ? 3.2 : rows.length > 18 ? 2.7 : 2.2
      const geometry = useMemo(() => {
        const sorted = [...rows].sort((a, b) => (b.ts || 0) - (a.ts || 0) || String(a.id).localeCompare(String(b.id)))
        const points = sorted.map((row, index) => {
          const t = sorted.length <= 1 ? 0 : index / (sorted.length - 1)
          const angle = -Math.PI / 2 + t * turns * Math.PI * 2
          const radius = 42 + t * 246
          return {
            ...row,
            x: 360 + Math.cos(angle) * radius,
            y: 310 + Math.sin(angle) * radius,
            angle,
            radius,
          }
        })
        let path = ''
        for (let index = 0; index <= 220; index += 1) {
          const t = index / 220
          const angle = -Math.PI / 2 + t * turns * Math.PI * 2
          const radius = 42 + t * 246
          path += `${index ? 'L' : 'M'}${(360 + Math.cos(angle) * radius).toFixed(2)} ${(310 + Math.sin(angle) * radius).toFixed(2)}`
        }
        return { points, path }
      }, [rows, turns])
      return h('svg', {
        className: 'wb-time-spiral',
        viewBox: '0 0 720 620',
        role: 'img',
        'aria-label': tr('sceneTimeTitle'),
        preserveAspectRatio: 'xMidYMid meet',
      },
        h('defs', null,
          h('radialGradient', { id: 'wb-time-glow', cx: '50%', cy: '50%', r: '50%' },
            h('stop', { offset: '0%', stopColor: 'rgba(222,193,137,.2)' }),
            h('stop', { offset: '100%', stopColor: 'rgba(222,193,137,0)' }))),
        h('circle', { cx: 360, cy: 310, r: 286, className: 'wb-time-orbit is-outer' }),
        h('circle', { cx: 360, cy: 310, r: 205, className: 'wb-time-orbit' }),
        h('circle', { cx: 360, cy: 310, r: 124, className: 'wb-time-orbit' }),
        h('circle', { cx: 360, cy: 310, r: 48, className: 'wb-time-orbit is-inner' }),
        h('circle', { cx: 360, cy: 310, r: 48, fill: 'url(#wb-time-glow)' }),
        h('path', { d: geometry.path, className: 'wb-time-coil' }),
        h('circle', { cx: 360, cy: 310, r: 3.2, className: 'wb-time-core' }),
        h('text', { x: 360, y: 330, className: 'wb-time-axis-label', textAnchor: 'middle' }, tr('sceneTimeNow')),
        h('text', { x: 360, y: 32, className: 'wb-time-axis-label is-muted', textAnchor: 'middle' }, tr('sceneTimeOuter')),
        geometry.points.map((row, index) => {
          const active = row.id === activeId
          const name = row.project?.displayName || row.project?.name || row.id
          const relative = row.ts ? relTime(new Date(row.ts).toISOString(), tr) : tr('sceneTimeNoDate')
          const labelX = row.x < 360 ? row.x + 12 : row.x - 12
          const labelAnchor = row.x < 360 ? 'start' : 'end'
          return h('g', { key: row.id },
            h('g', {
              className: cx('wb-time-dot', `is-${row.bucket}`, active && 'is-active'),
              transform: `translate(${row.x.toFixed(2)} ${row.y.toFixed(2)})`,
              role: 'button',
              tabIndex: 0,
              'aria-label': `${name} · ${relative}`,
              onClick: () => onActive(row.id),
              onDoubleClick: () => onEnter(row.project),
              onKeyDown: (event) => {
                if (event.key === 'Enter') { event.preventDefault(); onEnter(row.project) }
                if (event.key === ' ') { event.preventDefault(); onActive(row.id) }
              },
            },
              h('circle', { r: active ? 10 : 7, className: 'wb-time-dot-halo' }),
              h('circle', { r: active ? 3.8 : 2.5, className: 'wb-time-dot-core' }),
              h('title', null, `${name} · ${relative}`)),
            active ? h('g', { className: 'wb-time-active-label', transform: `translate(${labelX.toFixed(2)} ${(row.y - 12).toFixed(2)})` },
              h('line', { x1: 0, y1: 0, x2: row.x < 360 ? -8 : 8, y2: 8, className: 'wb-time-label-line' }),
              h('text', { textAnchor: labelAnchor, className: 'wb-time-label-name' }, truncate(name, 22)),
              h('text', { textAnchor: labelAnchor, dy: 12, className: 'wb-time-label-time' }, relative)) : null,
            index === 0 ? h('circle', { r: 2, cx: 0, cy: 0, className: 'wb-time-start-mark' }) : null)
        }))
    }

    function TimeView({ projects, activeId, onActive, onOpen, onOpenPath, onRefresh, onScene, tr, query, setQuery, bucket, setBucket }) {
      const [entering, setEntering] = useState('')
      const enterTimerRef = useRef(0)
      const reduced = earthReduced()
      useEffect(() => () => { if (enterTimerRef.current) clearTimeout(enterTimerRef.current) }, [])
      const now = Date.now()
      const rows = useMemo(() => projects.map((project) => {
        const ts = projectTime(project)
        return { id: project.id, project, ts, bucket: timeBucketFor(ts, now) }
      }).sort((a, b) => (b.ts || 0) - (a.ts || 0) || String(a.id).localeCompare(String(b.id))), [projects, now])
      const counts = useMemo(() => rows.reduce((result, row) => {
        result.all += 1
        result[row.bucket] = (result[row.bucket] || 0) + 1
        return result
      }, { all: 0, today: 0, week: 0, month: 0, quarter: 0, year: 0, older: 0, unknown: 0 }), [rows])
      const visibleRows = useMemo(() => {
        const needle = query.trim().toLowerCase()
        return rows.filter((row) => (bucket === 'all' || row.bucket === bucket)
          && (!needle || `${row.project.displayName} ${row.project.name} ${row.project.path} ${row.project.note || ''} ${row.project.summary || ''}`.toLowerCase().includes(needle)))
      }, [rows, bucket, query])
      const datedRows = visibleRows.filter((row) => row.ts)
      const unknownRows = visibleRows.filter((row) => !row.ts)
      const active = visibleRows.find((row) => row.id === activeId) || null
      const activeMedia = useProjectMedia(active?.id || '', active?.project?.representativeImage?.path || '')
      const cover = activeMedia.data?.representative || activeMedia.data?.items?.[0] || null
      const sessions = (active?.project?.sessions || []).slice().sort((a, b) => (Date.parse(b.updatedAt || '') || 0) - (Date.parse(a.updatedAt || '') || 0))
      const recentSession = sessions[0] || null
      const artifacts = active?.project?.runtime?.artifacts || []
      const createdTs = Date.parse(active?.project?.created || '') || 0
      const enterProject = (project) => {
        if (!project) return
        onActive(project.id)
        if (reduced) { onOpen(project); return }
        setEntering(project.id)
        clearTimeout(enterTimerRef.current)
        enterTimerRef.current = setTimeout(() => onOpen(project), 260)
      }
      const bucketLabel = (id) => tr((TIME_BUCKETS.find((item) => item.id === id) || TIME_BUCKETS[0]).labelKey)
      const mediaEmpty = activeMedia.status === 'loading' ? tr('sceneTimeMediaLoading')
        : activeMedia.status === 'error' ? tr('sceneTimeMediaFailed') : tr('sceneTimeMediaEmpty')
      return h('div', { className: cx('wb-time', 'wb-scene-enter', entering && 'is-entering', active && 'has-active') },
        h('header', { className: 'wb-time-top' },
          h('div', { className: 'wb-time-brand' },
            h('span', { className: 'wb-time-mark' }, h(Glyph, { name: 'clock', size: 18 })),
            h('div', null,
              h('div', { className: 'wb-time-overline' }, tr('sceneTimeKicker')),
              h('h1', null, tr('sceneTimeTitle')),
              h('p', null, tr('sceneTimeIntro')))),
          h('div', { className: 'wb-time-head-actions' },
            h('button', { type: 'button', className: 'wb-time-exit', onClick: () => onScene?.('table') }, h(Glyph, { name: 'list', size: 13 }), tr('sceneTimeExit')),
            h('label', { className: 'wb-time-search' },
              h(Glyph, { name: 'search', size: 14 }),
              h('input', { value: query, onChange: (event) => setQuery(event.target.value), placeholder: tr('sceneTimeSearch'), 'aria-label': tr('sceneTimeSearch') })))),
        h('div', { className: 'wb-time-body' },
          h('section', { className: 'wb-time-stage-wrap', 'aria-label': tr('sceneTimeTitle') },
            h('div', { className: 'wb-time-stagebar' },
              h('div', { className: 'wb-time-crumb' },
                h('span', null, tr('sceneTimeKicker')),
                h('b', null, bucket === 'all' ? tr('sceneTimeIndex') : bucketLabel(bucket))),
              h('div', { className: 'wb-time-buckets' }, TIME_BUCKETS.map((item) => h('button', {
                key: item.id, type: 'button', className: cx('wb-time-bucket', bucket === item.id && 'on'),
                onClick: () => setBucket(item.id),
              }, h('span', null, tr(item.labelKey)), h('small', null, String(counts[item.id] || 0))))),
              h('div', { className: 'wb-time-tools' },
                h('button', { type: 'button', className: 'wb-time-refresh', onClick: onRefresh, title: tr('sceneTimeRefresh'), 'aria-label': tr('sceneTimeRefresh') }, h(Glyph, { name: 'refresh', size: 13 })),
                h('span', { className: 'wb-time-count' }, tr('sceneTimeCount', { n: visibleRows.length })))),
            h('div', { className: 'wb-time-stage' },
              datedRows.length ? h(TimeSpiral, { rows: datedRows, activeId, onActive, onEnter: enterProject, tr })
                : h('div', { className: 'wb-time-empty' }, h(Glyph, { name: 'clock', size: 26 }), h('b', null, tr('sceneTimeEmpty')), h('span', null, unknownRows.length ? tr('sceneTimeEmptyUnknown') : tr('sceneTimeSelectHint'))),
              h('div', { className: 'wb-time-legend' },
                h('span', null, h('i', { className: 'is-recent' }), tr('sceneTimeInner')),
                h('span', null, h('i', { className: 'is-old' }), tr('sceneTimeOuter')),
                h('span', null, h('i', { className: 'is-unknown' }), tr('sceneTimeUnknown')))),
            unknownRows.length && datedRows.length ? h('p', { className: 'wb-time-unknown-note' }, tr('sceneTimePartialUnknown', { n: unknownRows.length })) : null),
          h('aside', { className: 'wb-time-rail' },
            h('div', { className: 'wb-time-index' },
              h('div', { className: 'wb-time-index-head' },
                h('span', null, tr('sceneTimeIndex')),
                h('small', null, tr('sceneTimeIndexHint'))),
              h('div', { className: 'wb-time-index-list' }, visibleRows.length ? visibleRows.map((row, index) => {
                const name = row.project.displayName || row.project.name || row.id
                return h('div', {
                  key: row.id,
                  className: cx('wb-time-row', row.id === activeId && 'is-active'),
                  role: 'button', tabIndex: 0,
                  'data-project-id': row.id,
                  title: row.project.path || name,
                  onClick: () => onActive(row.id),
                  onDoubleClick: () => enterProject(row.project),
                  onKeyDown: (event) => {
                    if (event.key === 'Enter') { event.preventDefault(); enterProject(row.project) }
                    if (event.key === ' ') { event.preventDefault(); onActive(row.id) }
                  },
                },
                  h('span', { className: 'wb-time-row-index' }, String(index + 1).padStart(2, '0')),
                  h('span', { className: 'wb-time-row-main' },
                    h('b', null, name),
                    h('small', null, `${lifecycleLabel(row.project.lifecycle, tr)} · ${row.ts ? relTime(new Date(row.ts).toISOString(), tr) : tr('sceneTimeNoDate')}`)),
                  h('span', { className: cx('wb-time-row-dot', `is-${row.bucket}`) }))
              }) : h('p', { className: 'wb-time-index-empty' }, tr('sceneTimeEmpty')))),
            h('div', { className: 'wb-time-inspector', 'aria-live': 'polite' },
              active ? h(React.Fragment, null,
                h('div', { className: 'wb-time-inspector-head' },
                  h('div', { className: 'wb-time-overline' }, tr('sceneTimeSelected')),
                  h('h2', null, active.project.displayName || active.project.name),
                  h('p', { className: 'wb-time-path', title: active.project.path }, active.project.path || '—')),
                h('div', { className: 'wb-time-media' },
                  cover ? h(MediaImage, { item: cover, className: 'wb-time-media-image', alt: active.project.displayName || active.project.name })
                    : h('div', { className: 'wb-time-media-empty' }, h(Glyph, { name: 'image', size: 18 }), h('span', null, mediaEmpty)),
                  h('span', { className: 'wb-time-media-label' }, tr('sceneTimeMedia'))),
                h('div', { className: 'wb-time-facts' },
                  h('span', { className: 'wb-time-fact is-life' }, lifecycleLabel(active.project.lifecycle, tr)),
                  h('span', { className: 'wb-time-fact' }, statusLabel(active.project.status, tr)),
                  h('span', { className: 'wb-time-fact' }, `${active.project.sessionCount ?? sessions.length} ${tr('sceneTimeSessions')}`),
                  h('span', { className: 'wb-time-fact' }, `${artifacts.length} ${tr('sceneTimeArtifacts')}`),
                  h('span', { className: 'wb-time-fact' }, fmtBytes(active.project.sizeBytes))),
                h('div', { className: 'wb-time-ledger' },
                  h('div', null, h('span', null, tr('sceneTimeCreated')), h('b', null, createdTs ? fmtDate(new Date(createdTs).toISOString()) : tr('sceneTimeNoRecord'))),
                  h('i', null),
                  h('div', null, h('span', null, tr('sceneTimeLast')), h('b', null, active.ts ? `${fmtDate(new Date(active.ts).toISOString())} · ${relTime(new Date(active.ts).toISOString(), tr)}` : tr('sceneTimeNoDate')))),
                active.ts ? null : h('p', { className: 'wb-time-no-date' }, tr('sceneTimeNoDateHint')),
                recentSession ? h('div', { className: 'wb-time-session' },
                  h('span', null, tr('sceneTimeRecentSession')),
                  h('b', null, recentSession.title || recentSession.id),
                  h('small', null, relTime(recentSession.updatedAt || '', tr))) : h('p', { className: 'wb-time-no-session' }, tr('sceneTimeNoSession')),
                h('div', { className: 'wb-time-actions' },
                  h('button', { type: 'button', className: 'wb-btn primary', onClick: () => enterProject(active.project) }, tr('sceneTimeEnter'), ' ↗'),
                  active.project.path ? h('button', { type: 'button', className: 'wb-btn ghost', onClick: () => onOpenPath?.(active.project.path) }, tr('sceneTimeOpenFolder')) : null),
                h('p', { className: 'wb-time-source' }, tr('sceneTimeLastSource')))
                : h('div', { className: 'wb-time-inspector-empty' },
                  h('div', { className: 'wb-time-overline' }, tr('sceneTimeSelected')),
                  h('p', null, tr('sceneTimeSelectHint'))))))
      )
    }

    function LibraryBook({ project, active, onSelect, tr }) {
      return h('button', {
        type: 'button', className: cx('wb-library-spine', active && 'is-active'),
        style: { '--spine-h': String(98 + (project.name || '').length % 4 * 10) + 'px' },
        onClick: () => onSelect(project.id), title: project.displayName || project.name,
      },
        h('span', { className: 'wb-library-spine-title' }, project.displayName || project.name),
        h('span', { className: 'wb-library-spine-meta' }, lifecycleLabel(project.lifecycle, tr)))
    }

    function libraryHash(project) {
      const text = String(project?.id || project?.name || '')
      let value = 0
      for (let index = 0; index < text.length; index += 1) value = ((value << 5) - value + text.charCodeAt(index)) | 0
      return Math.abs(value)
    }

    const LIBRARY_PAGE_SIZE = 10
    const libraryGroupId = (project) => ['persistent', 'incubating', 'temporary'].includes(project.lifecycle) ? project.lifecycle : 'unclassified'
    function libraryPage(items, requestedPage) {
      const count = Math.max(1, Math.ceil(items.length / LIBRARY_PAGE_SIZE))
      const page = Math.max(0, Math.min(count - 1, Number.isInteger(requestedPage) ? requestedPage : 0))
      return { page, count, items: items.slice(page * LIBRARY_PAGE_SIZE, (page + 1) * LIBRARY_PAGE_SIZE) }
    }

    function libraryShelf({ code, label, items, activeId, onSelect, onOpen, tr, x, y, width, height, rows, page = 0, onPage = () => {} }) {
      const visiblePage = libraryPage(items, page)
      const pageItems = visiblePage.items
      const innerX = 12
      const innerY = 34
      const innerWidth = width - 24
      const innerHeight = height - (visiblePage.count > 1 ? 74 : 42)
      const rowHeight = innerHeight / rows
      const perRow = Math.max(1, Math.ceil(pageItems.length / rows))
      const slotWidth = innerWidth / perRow
      const spineWidth = Math.max(7, Math.min(34, slotWidth - 5))
      const bookHeight = Math.max(22, Math.min(48, rowHeight - 15))
      return h('g', { key: code, className: 'wb-llib-shelf', transform: `translate(${x} ${y})` },
        h('rect', { className: 'wb-llib-shelf-shadow', x: 6, y: 8, width, height, rx: 3 }),
        h('path', { className: 'wb-llib-shelf-edge', d: `M${width} 0 l8 -6 v${height} l-8 6 Z`, 'aria-hidden': 'true', pointerEvents: 'none' }),
        h('rect', { className: 'wb-llib-shelf-case', x: 0, y: 0, width, height, rx: 3 }),
        h('rect', { className: 'wb-llib-shelf-back', x: 8, y: 28, width: width - 16, height: height - 36, rx: 2 }),
        h('path', { className: 'wb-llib-shelf-top', d: `M0 0 l8 -6 h${width} l-8 6 Z`, 'aria-hidden': 'true', pointerEvents: 'none' }),
        h('path', { className: 'wb-llib-shelf-wood', d: `M0 0 H${width} M0 ${height} H${width}` }),
        h('rect', { className: 'wb-llib-shelf-plaque', x: 8, y: 8, width: Math.min(190, width - 16), height: 16, rx: 1 }),
        h('text', { className: 'wb-llib-shelf-code', x: 14, y: 20 }, code),
        h('text', { className: 'wb-llib-shelf-label', x: 31, y: 20 }, label),
        h('text', { className: 'wb-llib-shelf-count', x: width - 14, y: 20, textAnchor: 'end' }, String(items.length)),
        Array.from({ length: rows }).map((_, row) => {
          const rowTop = innerY + row * rowHeight
          return h('g', { key: 'row' + row },
            h('line', { className: 'wb-llib-shelf-board', x1: 10, x2: width - 10, y1: rowTop + rowHeight - 2, y2: rowTop + rowHeight - 2 }),
            pageItems.slice(row * perRow, row * perRow + perRow).map((project, index) => {
              const itemHeight = Math.max(16, Math.min(bookHeight, bookHeight - (libraryHash(project) % 15)))
              const baseX = innerX + index * slotWidth + (slotWidth - spineWidth) / 2
              const baseY = rowTop + rowHeight - 8
              const tone = `is-${libraryGroupId(project)}`
              const active = project.id === activeId
              const name = project.displayName || project.name || project.id
              const nameChars = Array.from(String(name))
              const title = `${name} · ${lifecycleLabel(project.lifecycle, tr)}`
              return h('g', {
                key: project.id,
                className: cx('wb-llib-book', tone, active && 'is-active'),
                transform: `translate(${baseX} ${baseY})`,
                role: 'button', tabIndex: 0,
                'aria-label': title,
                'aria-pressed': active,
                title,
                onClick: () => onSelect(project.id),
                onDoubleClick: () => onOpen(project),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') { event.preventDefault(); onOpen(project) }
                  else if (event.key === ' ') { event.preventDefault(); onSelect(project.id) }
                },
              },
                h('rect', { className: 'wb-llib-book-hit', x: -slotWidth / 2 + spineWidth / 2, y: -rowHeight, width: slotWidth, height: rowHeight, fill: 'transparent' }),
                h('rect', { className: 'wb-llib-spine', x: 0, y: -itemHeight, width: spineWidth, height: itemHeight, rx: 1.2 }),
                h('rect', { x: 1, y: -itemHeight + 2, width: Math.max(1, spineWidth * .15), height: itemHeight - 4, fill: 'rgba(255,245,220,.18)', pointerEvents: 'none', 'aria-hidden': 'true' }),
                h('path', { className: 'wb-llib-spine-band', d: `M0 ${-itemHeight + 3} H${spineWidth} M0 ${-3} H${spineWidth}` }),
                h('text', { className: 'wb-llib-spine-name', x: spineWidth / 2, y: -itemHeight + 12, textAnchor: 'middle', 'aria-hidden': 'true' }, nameChars.slice(0, 3).join('')),
                nameChars.length > 3 ? h('text', { className: 'wb-llib-spine-name', x: spineWidth / 2, y: -itemHeight + 21, textAnchor: 'middle', 'aria-hidden': 'true' }, nameChars.slice(-3).join('')) : null,
                active ? h('path', { className: 'wb-llib-bookmark', d: `M${spineWidth - 3} ${-itemHeight + 2} v10 l3 -3 l-3 -3` }) : null)
            }))
        }),
        visiblePage.count > 1 ? h('g', { className: 'wb-llib-pagination' },
          [-1, 1].map((direction) => {
            const disabled = direction < 0 ? visiblePage.page === 0 : visiblePage.page === visiblePage.count - 1
            const action = () => { if (!disabled) onPage(visiblePage.page + direction) }
            return h('g', {
              key: direction, className: 'wb-llib-page-button', role: 'button', tabIndex: disabled ? -1 : 0,
              'aria-disabled': disabled, 'aria-label': `${label} · ${tr(direction < 0 ? 'sceneLibraryPreviousPage' : 'sceneLibraryNextPage')}`,
              onClick: action,
              onKeyDown: (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action() } },
            },
              h('rect', { x: direction < 0 ? width / 2 - 60 : width / 2 + 32, y: height - 26, width: 28, height: 20, rx: 3 }),
              h('text', { x: direction < 0 ? width / 2 - 46 : width / 2 + 46, y: height - 11, textAnchor: 'middle', 'aria-hidden': 'true' }, direction < 0 ? '‹' : '›'))
          }),
          h('text', { className: 'wb-llib-page-count', x: width / 2, y: height - 11, textAnchor: 'middle', 'aria-label': `${tr('sceneLibraryPage')} ${visiblePage.page + 1} / ${visiblePage.count}` }, `${visiblePage.page + 1} / ${visiblePage.count}`)) : null)
    }

    function LibraryReadingTable({ reading, cover, tr }) {
      const name = reading?.displayName || reading?.name || ''
      return h('g', { className: 'wb-llib-table', transform: 'translate(300 340)' },
        h('g', { 'aria-hidden': 'true', pointerEvents: 'none' },
          [85, 230, 360].map((x) => h('g', { key: x },
            h('rect', { className: 'wb-llib-seat', x: x - 23, y: -18, width: 46, height: 25, rx: 5 }),
            h('rect', { className: 'wb-llib-seat-cushion', x: x - 18, y: -14, width: 36, height: 13, rx: 3 }),
            h('rect', { className: 'wb-llib-seat', x: x - 23, y: 161, width: 46, height: 25, rx: 5 }),
            h('rect', { className: 'wb-llib-seat-cushion', x: x - 18, y: 169, width: 36, height: 13, rx: 3 })))),
        h('rect', { className: 'wb-llib-table-shadow', x: 8, y: 12, width: 430, height: 168, rx: 8 }),
        h('rect', { className: 'wb-llib-table-top', x: 0, y: 0, width: 430, height: 168, rx: 7 }),
        h('rect', { className: 'wb-llib-table-leather', x: 10, y: 10, width: 410, height: 148, rx: 5 }),
        h('path', { className: 'wb-llib-table-grain', d: 'M20 28 H410 M20 142 H410' }),
        h('g', { className: 'wb-llib-open-book', transform: 'translate(158 42)' },
          h('path', { className: 'wb-llib-open-page', d: 'M0 10 Q34 -2 70 10 V76 Q36 66 0 76Z' }),
          h('path', { className: 'wb-llib-open-page', d: 'M70 10 Q106 -2 140 10 V76 Q106 66 70 76Z' }),
          h('path', { className: 'wb-llib-open-lines', d: 'M12 24 H58 M12 34 H58 M12 44 H56 M82 24 H128 M82 34 H128 M82 44 H124' }),
          h('path', { className: 'wb-llib-open-spine', d: 'M70 8 V78' })),
        h('g', { className: 'wb-llib-lamp', transform: 'translate(360 42)' },
          h('ellipse', { className: 'wb-llib-lamp-glow', cx: 0, cy: 18, rx: 48, ry: 24 }),
          h('path', { className: 'wb-llib-lamp-arm', d: 'M0 0 V34 M0 0 L-18 -14' }),
          h('path', { className: 'wb-llib-lamp-shade', d: 'M-34 -12 Q-18 -28 18 -12 L12 -2 Q-12 6 -34 -12Z' }),
          h('circle', { className: 'wb-llib-lamp-bulb', cx: 0, cy: 2, r: 3 })),
        h('g', { className: 'wb-llib-cup', transform: 'translate(306 132)' },
          h('path', { d: 'M0 0 h12 v9 h-12z M12 3 q8 0 0 5' }),
          h('path', { className: 'wb-llib-steam', d: 'M4 -3 c-3 -5 4 -5 0 -10 M9 -3 c-3 -5 4 -5 0 -10' })),
        reading ? h('g', { className: 'wb-llib-selected-cover', transform: 'translate(18 22) rotate(-3)' },
          h('rect', { className: 'wb-llib-cover-shadow', x: 3, y: 4, width: 92, height: 122, rx: 2 }),
          cover?.url
            ? h('image', { href: cover.url, x: 0, y: 0, width: 92, height: 122, preserveAspectRatio: 'xMidYMid slice', clipPath: 'url(#wbLibCoverClip)' })
            : h('g', null,
                h('rect', { className: 'wb-llib-cover-empty', x: 0, y: 0, width: 92, height: 122, rx: 2 }),
                h('path', { className: 'wb-llib-cover-line', d: 'M14 18 H78 M14 28 H62' }),
                h('text', { className: 'wb-llib-cover-title', x: 46, y: 72, textAnchor: 'middle' }, String(name).slice(0, 8)),
                h('text', { className: 'wb-llib-cover-sub', x: 46, y: 88, textAnchor: 'middle' }, tr('sceneLibraryHonest'))),
          h('path', { className: 'wb-llib-cover-ribbon', d: 'M70 0 v22 l-6 -4 l-6 4 V0' })) : null,
        reading ? h('text', { className: 'wb-llib-title-on-table', x: 148, y: 148, 'aria-hidden': 'true', title: name },
          Array.from(name).length > 15 ? Array.from(name).slice(0, 15).join('') + '…' : name) : null)
    }

    function LibraryView({ projects, activeId, onActive, onOpen, onOpenPath, onScene, tr, query, setQuery, shelf, setShelf }) {
      const [opening, setOpening] = useState('')
      const [inspectorOpen, setInspectorOpen] = useState(false)
      const openTimerRef = useRef(0)
      const reduced = earthReduced()
      const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase()
        return projects.filter((project) => {
          if (shelf !== 'all' && libraryGroupId(project) !== shelf) return false
          if (!needle) return true
          return (project.displayName || project.name || '').toLowerCase().includes(needle)
            || (project.path || '').toLowerCase().includes(needle)
            || (project.note || '').toLowerCase().includes(needle)
            || (project.summary || '').toLowerCase().includes(needle)
        })
      }, [projects, query, shelf])
      const reading = filtered.find((project) => project.id === activeId) || filtered[0] || null
      const media = useProjectMedia(reading?.id, reading?.representativeImage?.path || '')
      const cover = media.data?.representative || media.data?.items?.[0] || null
      const sessions = (reading?.sessions || []).slice().sort((a, b) => (Date.parse(b.updatedAt || '') || 0) - (Date.parse(a.updatedAt || '') || 0))
      const artifacts = reading?.runtime?.artifacts || []
      const mediaEmpty = media.status === 'loading' ? tr('sceneLibraryMediaLoading') : media.status === 'error' ? tr('sceneLibraryMediaFailed') : tr('sceneLibraryHonest')
      const [pages, setPages] = useState({})
      const selectReading = (id) => {
        const project = filtered.find((item) => item.id === id)
        if (project) {
          const group = libraryGroupId(project)
          const position = filtered.filter((item) => libraryGroupId(item) === group).findIndex((item) => item.id === id)
          setPages((previous) => ({ ...previous, [group]: Math.floor(position / LIBRARY_PAGE_SIZE) }))
        }
        onActive(id); setInspectorOpen(true)
      }
      useEffect(() => {
        const project = filtered.find((item) => item.id === activeId)
        if (!project) return
        const group = libraryGroupId(project)
        const position = filtered.filter((item) => libraryGroupId(item) === group).findIndex((item) => item.id === activeId)
        setPages((previous) => ({ ...previous, [group]: Math.floor(position / LIBRARY_PAGE_SIZE) }))
      }, [activeId, query, shelf, projects])
      useEffect(() => () => { if (openTimerRef.current) clearTimeout(openTimerRef.current) }, [])
      const openBook = (project) => {
        if (!project || opening) return
        if (reduced) { onOpen(project); return }
        setOpening(project.id)
        openTimerRef.current = setTimeout(() => { openTimerRef.current = 0; setOpening(''); onOpen(project) }, 260)
      }
      const groups = [
        ['persistent', tr('sceneShelfPersistent'), 'A'],
        ['incubating', tr('sceneShelfIncubating'), 'B'],
        ['temporary', tr('sceneShelfTemporary'), 'C'],
        ['unclassified', tr('sceneShelfUnclassified'), 'D'],
      ].map(([id, label, code]) => ({ id, label, code, items: filtered.filter((project) => libraryGroupId(project) === id) }))
      const shelves = [
        { code: 'A', label: tr('sceneShelfPersistent'), items: groups[0].items, x: 40, y: 82, width: 230, height: 184, rows: 2 },
        { code: 'B', label: tr('sceneShelfIncubating'), items: groups[1].items, x: 300, y: 82, width: 440, height: 220, rows: 2 },
        { code: 'C', label: tr('sceneShelfTemporary'), items: groups[2].items, x: 40, y: 292, width: 230, height: 228, rows: 2 },
        { code: 'D', label: tr('sceneShelfUnclassified'), items: groups[3].items, x: 770, y: 292, width: 230, height: 228, rows: 2 },
      ]
      const scene = h('svg', {
        className: 'wb-llib-svg', viewBox: '0 0 1040 600', role: 'group',
        'aria-label': `${tr('sceneLibraryTitle')} · ${String(filtered.length)} ${tr('projects')}`,
      },
        h('defs', null,
          h('linearGradient', { id: 'wbLibFloor', x1: '0', y1: '0', x2: '0', y2: '1' },
            h('stop', { offset: '0', stopColor: '#ddc7a6' }), h('stop', { offset: '1', stopColor: '#bda17f' })),
          h('radialGradient', { id: 'wbLibLamp', cx: '50%', cy: '46%', r: '58%' },
            h('stop', { offset: '0', stopColor: 'rgba(240,204,139,.26)' }), h('stop', { offset: '.55', stopColor: 'rgba(226,185,119,.08)' }), h('stop', { offset: '1', stopColor: 'rgba(226,185,119,0)' })),
          h('pattern', { id: 'wbLibPlanks', width: 112, height: 26, patternUnits: 'userSpaceOnUse' },
            h('path', { d: 'M0 26 H112 M56 0 V26 M0 0 V26', fill: 'none', stroke: 'rgba(18,12,7,.28)', strokeWidth: 1 })),
          h('clipPath', { id: 'wbLibCoverClip' }, h('rect', { x: 0, y: 0, width: 92, height: 122, rx: 2 }))),
        h('rect', { className: 'wb-llib-backdrop', x: 0, y: 0, width: 1040, height: 600 }),
        h('rect', { className: 'wb-llib-floor', x: 20, y: 64, width: 1000, height: 516, rx: 4, fill: 'url(#wbLibFloor)' }),
        h('rect', { className: 'wb-llib-planks', x: 20, y: 64, width: 1000, height: 516, fill: 'url(#wbLibPlanks)' }),
        h('path', { className: 'wb-llib-wall', d: 'M20 64 H1020 V28 H20 Z' }),
        h('path', { className: 'wb-llib-window', d: 'M420 28 V64 M462 28 V64 M502 28 V64 M542 28 V64 M582 28 V64 M620 28 V64' }),
        h('path', { className: 'wb-llib-arch', d: 'M410 64 V43 Q410 24 430 24 H610 Q630 24 630 43 V64' }),
        h('path', { className: 'wb-llib-arch-inner', d: 'M420 64 V45 Q420 34 436 34 H604 Q620 34 620 45 V64' }),
        h('g', { 'aria-hidden': 'true', pointerEvents: 'none' },
          h('path', { className: 'wb-llib-window-glow', d: 'M426 64 H466 L404 299 H331 Z M514 64 H554 L541 299 H474 Z M602 64 H618 L699 299 H640 Z' }),
          h('path', { d: 'M20 64 V580 H35 V64 M1005 64 V580 H1020 V64', fill: '#627b70', stroke: '#4b655a', strokeWidth: 3 }),
          h('path', { d: 'M36 554 H1004 M36 562 H1004', stroke: '#e2cba7', strokeWidth: 2, fill: 'none' }),
          h('rect', { x: 73, y: 36, width: 96, height: 17, fill: '#a9c2b6', stroke: '#e2e1ca', strokeWidth: 3 }),
          h('path', { d: 'M105 37 V52 M137 37 V52', stroke: '#e2e1ca', strokeWidth: 3 }),
          h('rect', { x: 871, y: 36, width: 96, height: 17, fill: '#a9c2b6', stroke: '#e2e1ca', strokeWidth: 3 }),
          h('path', { d: 'M903 37 V52 M935 37 V52', stroke: '#e2e1ca', strokeWidth: 3 })),
        h('ellipse', { className: 'wb-llib-light', cx: 500, cy: 330, rx: 300, ry: 220 }),
        h('ellipse', { className: 'wb-llib-light', cx: 880, cy: 160, rx: 160, ry: 120 }),
        h('rect', { className: 'wb-llib-rug', x: 286, y: 326, width: 474, height: 212, rx: 6 }),
        h('rect', { x: 295, y: 335, width: 456, height: 194, rx: 3, fill: 'none', stroke: '#c2c7aa', strokeWidth: 2, pointerEvents: 'none', 'aria-hidden': 'true' }),
        h('path', { className: 'wb-llib-wall-base', d: 'M36 72 H1004 M36 574 H1004' }),
        shelves.map((item, index) => libraryShelf({ ...item, activeId, onSelect: selectReading, onOpen: openBook, tr,
          page: pages[groups[index].id], onPage: (page) => setPages((previous) => ({ ...previous, [groups[index].id]: page })) })),
        h('g', { className: 'wb-llib-catalog', transform: 'translate(780 96)' },
          h('rect', { className: 'wb-llib-catalog-shadow', x: 5, y: 6, width: 208, height: 154, rx: 3 }),
          h('rect', { className: 'wb-llib-catalog-case', x: 0, y: 0, width: 208, height: 154, rx: 3 }),
          h('text', { className: 'wb-llib-catalog-title', x: 12, y: 18 }, tr('sceneLibraryCatalog')),
          Array.from({ length: 12 }).map((_, index) => h('g', { key: 'drawer' + index },
            h('rect', { className: 'wb-llib-drawer', x: 12 + (index % 4) * 47, y: 30 + Math.floor(index / 4) * 38, width: 41, height: 29, rx: 1.5 }),
            h('circle', { className: 'wb-llib-drawer-knob', cx: 32.5 + (index % 4) * 47, cy: 44 + Math.floor(index / 4) * 38, r: 1.5 }),
            h('text', { className: 'wb-llib-drawer-label', x: 32.5 + (index % 4) * 47, y: 53 + Math.floor(index / 4) * 38, textAnchor: 'middle' }, String.fromCharCode(65 + index)))),
          h('rect', { className: 'wb-llib-globe-stand', x: 162, y: 78, width: 20, height: 26, rx: 2 }),
          h('circle', { className: 'wb-llib-globe', cx: 172, cy: 65, r: 15 }),
          h('path', { className: 'wb-llib-globe-line', d: 'M157 65 H187 M172 50 V80 M162 54 Q172 65 162 76 M182 54 Q172 65 182 76' })),
        h('g', { className: 'wb-llib-ladder', transform: 'translate(258 160) rotate(14)' },
          h('path', { className: 'wb-llib-ladder-rail', d: 'M0 0 V114 M18 0 V114' }),
          Array.from({ length: 5 }).map((_, index) => h('line', { key: 'rung' + index, className: 'wb-llib-ladder-rung', x1: 0, x2: 18, y1: 18 + index * 20, y2: 18 + index * 20 }))),
        LibraryReadingTable({ reading, cover, tr }),
        h('g', { 'aria-hidden': 'true', pointerEvents: 'none' },
          h('ellipse', { cx: 278, cy: 303, rx: 12, ry: 5, fill: 'rgba(60,50,37,.25)' }),
          h('rect', { x: 269, y: 287, width: 18, height: 15, rx: 2, fill: '#b87d5e', stroke: '#805643', strokeWidth: 2 }),
          h('path', { d: 'M278 289 C260 270 266 259 278 279 C283 256 296 264 284 289Z', fill: '#6c9a77', stroke: '#4f7c60', strokeWidth: 2 }),
          h('ellipse', { cx: 759, cy: 552, rx: 12, ry: 5, fill: 'rgba(60,50,37,.25)' }),
          h('rect', { x: 750, y: 537, width: 18, height: 15, rx: 2, fill: '#b87d5e', stroke: '#805643', strokeWidth: 2 }),
          h('path', { d: 'M759 539 C741 520 747 509 759 529 C764 506 777 514 765 539Z', fill: '#6c9a77', stroke: '#4f7c60', strokeWidth: 2 })),
        h('text', { className: 'wb-llib-floor-note', x: 40, y: 574 }, tr('sceneLibrarySpatialNote')),
        filtered.length ? null : h('text', { className: 'wb-llib-no-match', x: 520, y: 310, textAnchor: 'middle' }, tr('sceneLibraryNoMatch')))
      return h('div', { className: cx('wb-library', 'wb-llib', 'wb-scene-enter', opening && 'is-opening', !inspectorOpen && 'is-inspector-collapsed') },
        h('header', { className: 'wb-llib-top' },
          h('div', { className: 'wb-llib-brand' },
            h('span', { className: 'wb-llib-mark' }, h(Glyph, { name: 'library', size: 18 })),
            h('div', null,
              h('div', { className: 'wb-earth-overline' }, tr('sceneLibraryKicker')),
              h('h1', null, tr('sceneLibraryTitle')),
              h('p', null, tr('sceneLibraryIntro')))),
          h('div', { className: 'wb-llib-head-actions' },
            h('button', { type: 'button', className: 'wb-llib-exit', onClick: () => onScene?.('table') }, h(Glyph, { name: 'list', size: 13 }), tr('sceneLibraryExit')),
            h('label', { className: 'wb-llib-search' }, h(Glyph, { name: 'search', size: 14 }), h('input', { value: query, onChange: (event) => setQuery(event.target.value), placeholder: tr('sceneLibrarySearch'), 'aria-label': tr('sceneLibrarySearch') })))),
        h('div', { className: 'wb-llib-body' },
          h('section', { className: 'wb-llib-stage-wrap', 'aria-label': tr('sceneLibraryTitle') },
            h('div', { className: 'wb-llib-stagebar' },
              h('div', { className: 'wb-llib-crumb' }, h('span', null, tr('sceneLibraryKicker')), h('b', null, tr('sceneLibraryReadingRoom'))),
              h('div', { className: 'wb-llib-tabs' },
                h('button', { type: 'button', className: cx('wb-llib-tab', shelf === 'all' && 'on'), onClick: () => setShelf('all') }, tr('all'), ' ', h('small', null, String(projects.length))),
                groups.map((group) => h('button', { key: group.id, type: 'button', className: cx('wb-llib-tab', shelf === group.id && 'on'), onClick: () => setShelf(group.id) }, group.label, ' ', h('small', null, String(group.items.length))))),
              h('div', { className: 'wb-llib-count' }, `${filtered.length} / ${projects.length}`),
              h('button', { type: 'button', className: 'wb-scene-details-toggle', 'aria-expanded': inspectorOpen, onClick: () => setInspectorOpen((open) => !open) }, tr(inspectorOpen ? 'sceneHideDetails' : 'sceneShowDetails'))),
            h('div', { className: 'wb-llib-stage', role: 'region', tabIndex: 0, 'aria-label': tr('sceneLibraryReadingRoom') }, scene),
            h('div', { className: 'wb-llib-project-index', role: 'group', 'aria-label': tr('sceneProjectIndex') },
              h('span', null, tr('sceneProjectIndex')),
              filtered.map((project) => h('button', {
                key: project.id, type: 'button', 'aria-pressed': reading?.id === project.id,
                onClick: () => selectReading(project.id), onDoubleClick: () => openBook(project),
                title: project.displayName || project.name || project.id,
              }, project.displayName || project.name || project.id)))),
          h('aside', { className: 'wb-llib-inspector', 'aria-live': 'polite' },
            reading ? h(React.Fragment, null,
              h('div', { className: 'wb-llib-inspector-overline' }, tr('sceneLibraryDesk')),
              h('h2', null, reading.displayName || reading.name),
              h('p', { className: 'wb-llib-path', title: reading.path }, reading.path || '—'),
              h('div', { className: 'wb-llib-cover' },
                cover ? h(MediaImage, { item: cover, className: 'wb-llib-cover-image', alt: reading.displayName || reading.name })
                  : h('div', { className: 'wb-llib-cover-empty' }, h(Glyph, { name: 'image', size: 18 }), h('span', null, mediaEmpty)),
                h('span', { className: 'wb-llib-cover-label' }, tr('sceneLibraryCover'))),
              h('div', { className: 'wb-llib-facts' },
                h('span', null, lifecycleLabel(reading.lifecycle, tr)),
                h('span', null, statusLabel(reading.status, tr)),
                h('span', null, `${reading.sessionCount || sessions.length} ${tr('sessions')}`),
                h('span', null, `${artifacts.length} ${tr('sceneLibraryArtifacts')}`)),
              h('div', { className: 'wb-llib-ledger' },
                h('div', null, h('span', null, tr('sceneLibraryCreated')), h('b', null, reading.created ? fmtDate(reading.created) : tr('sceneTimeNoRecord'))),
                h('i', null),
                h('div', null, h('span', null, tr('sceneLibraryLast')), h('b', null, reading.lastActivity ? `${fmtDate(reading.lastActivity)} · ${relTime(reading.lastActivity, tr)}` : tr('sceneTimeNoRecord')))),
              h('p', { className: 'wb-llib-note' }, reading.note || reading.summary || tr('earthNoNote')),
              h('div', { className: 'wb-llib-sessions' },
                h('span', { className: 'wb-llib-section-label' }, tr('sceneLibrarySessions')),
                sessions.length ? sessions.slice(0, 3).map((session) => h('button', { key: session.id || session.title, type: 'button', className: 'wb-llib-session', onClick: () => onOpen(reading, 'sessions') },
                  h('b', null, session.title || session.id || tr('sessions')),
                  h('small', null, session.updatedAt ? relTime(session.updatedAt, tr) : tr('sceneTimeNoDate'))))
                  : h('p', { className: 'wb-llib-no-session' }, tr('sceneLibraryNoSession'))),
              h('div', { className: 'wb-llib-actions' },
                h('button', { type: 'button', className: 'wb-btn primary', onClick: () => openBook(reading) }, tr('sceneOpenBook'), ' ↗'),
                h('button', { type: 'button', className: 'wb-btn ghost', onClick: () => onOpen(reading, 'sessions') }, tr('sceneLibrarySessions')),
                reading.path ? h('button', { type: 'button', className: 'wb-btn ghost', onClick: () => onOpenPath?.(reading.path) }, tr('earthAnchorFolder')) : null),
              h('p', { className: 'wb-llib-source' }, tr('sceneLibrarySource')))
              : h('div', { className: 'wb-llib-inspector-empty' }, h(Glyph, { name: 'library', size: 24 }), h('b', null, tr('sceneLibraryNoBook')), h('p', null, String(tr('sceneLibrarySelect')) === 'sceneLibrarySelect' ? '点击书脊选择项目；双击或回车打开。' : tr('sceneLibrarySelect'))))))
    }

    function studioRoomStyle(room) {
      if (room.kind === 'offices') return { left: '18px', top: '58px', width: '312px', height: '230px' }
      if (room.kind === 'workshop') {
        const col = room.index % 2
        const row = Math.floor(room.index / 2)
        return { left: `${350 + col * 348}px`, top: `${58 + row * 212}px`, width: '330px', height: '196px' }
      }
      if (room.kind === 'shared') return { left: '18px', top: '300px', width: '312px', height: '130px' }
      return { left: '18px', top: '446px', width: '312px', height: '146px' }
    }

    function atelierTone(project) {
      const state = String(project?.runtime?.state || '')
      if (state === 'running') return 'is-running'
      if (state === 'waiting') return 'is-waiting'
      if (state === 'blocked' || state === 'failed') return 'is-failed'
      if (project?.needsFollowup) return 'is-attention'
      return 'is-idle'
    }

    function AtelierFigure({ x, y, tone = 'is-idle', seated = false, scale = 1, delay = 0, className = '' }) {
      return h('g', {
        className: cx('wb-atelier-figure', tone, seated && 'is-seated', className),
        transform: `translate(${x} ${y}) scale(${scale})`,
        style: delay ? { animationDelay: `${delay}s` } : undefined,
        'aria-hidden': 'true',
      },
        h('ellipse', { className: 'wb-atelier-figure-shadow', cx: 0, cy: seated ? 15 : 22, rx: 9, ry: 3 }),
        h('rect', { className: 'wb-atelier-figure-legs', x: -5.2, y: seated ? 6 : 7, width: 10.4, height: seated ? 8 : 14, rx: 2.2 }),
        h('path', { className: 'wb-atelier-figure-body', d: seated ? 'M-8 -3 Q0 -8 8 -3 L9 9 Q0 12 -9 9Z' : 'M-7 -4 Q0 -9 7 -4 L8 9 Q0 12 -8 9Z' }),
        h('path', { className: 'wb-atelier-figure-arm', d: seated ? 'M-7 -1 L-11 8 M7 -1 L11 8' : 'M-7 0 L-10 9 M7 0 L10 9' }),
        h('circle', { className: 'wb-atelier-figure-head', cx: 0, cy: seated ? -9 : -11, r: 5.2 }),
        h('path', { className: 'wb-atelier-figure-hair', d: seated ? 'M-5.2 -11 Q-3 -16 1 -16 Q5.4 -15 5.2 -10 Q2.6 -13 -1 -12 Q-3.8 -11 -5.2 -8Z' : 'M-5.2 -13 Q-2 -18 2 -17 Q5.4 -16 5.2 -10 Q2.2 -14 -5.2 -10Z' }))
    }

    function AtelierPersonLabel({ x, y, text }) {
      return h('g', { className: 'wb-atelier-person-label', transform: `translate(${x} ${y})`, 'aria-hidden': 'true' },
        h('rect', { x: -22, y: -7, width: 44, height: 12, rx: 6 }),
        h('text', { x: 0, y: 2, textAnchor: 'middle' }, text))
    }

    const STUDIO_ROOM_CAPACITY = 24

    // Page the complete collection before applying the search filter. A search
    // must not renumber rooms or move a project to a different work area.
    function studioRooms(projects, visibleProjects, tr) {
      const groups = { persistent: [], incubating: [], temporary: [], unclassified: [] }
      for (const project of projects) {
        const lifecycle = Object.hasOwn(groups, project.lifecycle) ? project.lifecycle : 'unclassified'
        groups[lifecycle].push(project)
      }
      const visible = new Set(visibleProjects)
      const specs = [
        ['persistent', 'offices', 'A', 'sceneStudioPersistent'],
        ['incubating', 'workshop', 'B', 'sceneStudioIncubating'],
        ['temporary', 'shared', 'C', 'sceneStudioTemporary'],
        ['unclassified', 'intake', 'D', 'sceneStudioUnclassified'],
      ]
      const result = []
      for (const [lifecycle, kind, prefix, labelKey] of specs) {
        // Id ordering keeps page assignments stable when the source changes order.
        const items = groups[lifecycle].slice().sort((a, b) => {
          const left = String(a.id), right = String(b.id)
          return left < right ? -1 : left > right ? 1 : 0
        })
        for (let start = 0, index = 0; start < items.length; start += STUDIO_ROOM_CAPACITY, index += 1) {
          const part = items.slice(start, start + STUDIO_ROOM_CAPACITY).filter((project) => visible.has(project))
          if (!part.length) continue
          const number = String(index + 1).padStart(2, '0')
          const id = lifecycle === 'incubating' || index > 0 ? `${lifecycle}-${index}` : lifecycle
          result.push({ id, kind, code: prefix + number, index, label: tr(labelKey) + ' ' + number, projects: part })
        }
      }
      return result
    }

    function studioDeskLayout(count) {
      const cols = count <= 1 ? 1 : count <= 4 ? 2 : count <= 9 ? 3 : count <= 16 ? 4 : 5
      const rows = Math.max(1, Math.ceil(count / cols))
      const width = Math.min(690, cols * 150), height = Math.min(398, rows * 92)
      const left = 44 + (690 - width) / 2, top = count <= 9 ? 156 : 124
      const cellW = width / cols, cellH = height / rows
      return { count, cols, rows, left, top, width, height, cellW, cellH, deskW: Math.min(146, cellW - 12), deskH: Math.min(58, cellH - 10) }
    }

    // Office-only figures; walking figures are decorative, not agent status.
    function OfficePixelPerson({ x, y, tone = 'is-idle', seated = false, scale = 1, walking = false, variant = 0 }) {
      const shirts = ['#7095a1', '#bb8872', '#859c78', '#a48ca2']
      const shirt = shirts[variant % shirts.length]
      const pixel = (key, x, y, width, height, fill) => h('rect', { key, x, y, width, height, fill })
      return h('g', { className: cx('wb-office-pixel', walking && 'is-walking'),
        transform: `translate(${x} ${y}) scale(${scale})`, 'aria-hidden': 'true' },
        pixel('shadow', -9, 17, 18, 4, 'rgba(43,39,31,.25)'),
        h('g', { className: 'wb-office-step-a' },
          pixel('leg1', -6, 9, 5, 9, '#43565a'), pixel('leg2', 2, 9, 5, 9, '#43565a'),
          pixel('shoe1', -7, 16, 6, 3, '#293b40'), pixel('shoe2', 2, 16, 6, 3, '#293b40')),
        h('g', { className: 'wb-office-step-b' },
          pixel('leg1', -7, 9, 5, 6, '#43565a'), pixel('leg2', 2, 9, 5, 10, '#43565a'),
          pixel('shoe1', -9, 13, 7, 3, '#293b40'), pixel('shoe2', 3, 17, 7, 3, '#293b40')),
        pixel('body-shadow', -9, -3, 18, 14, '#49616a'),
        pixel('shirt', -7, -3, 14, 12, shirt),
        pixel('shirt-light', -4, -2, 8, 2, '#e7d3b8'),
        pixel('shirt-shadow', -7, 6, 14, 2, '#556f75'),
        pixel('arm-l', -11, -1, 4, 10, shirt), pixel('arm-r', 7, -1, 4, 10, shirt),
        pixel('hand-l', -11, 7, 4, 3, '#e3b892'), pixel('hand-r', 7, 7, 4, 3, '#e3b892'),
        pixel('head-shadow', -7, -15, 14, 13, '#4b3a35'),
        pixel('face', -5, -13, 10, 10, '#e3b892'),
        pixel('hair', -6, -15, 12, 4, '#443731'),
        pixel('hair-light', -4, -15, 7, 2, '#675349'),
        pixel('hair-side', -7, -12, 3, 6, '#443731'),
        pixel('eye-l', -3, -9, 2, 2, '#3e3632'), pixel('eye-r', 2, -9, 2, 2, '#3e3632'))
    }

    function OfficePixelPlant({ x, y, scale = 1 }) {
      return h('g', { className: 'wb-office-pixel', transform: `translate(${x} ${y}) scale(${scale})`, 'aria-hidden': 'true' },
        h('rect', { x: -8, y: 2, width: 16, height: 12, fill: '#a9654e' }),
        h('rect', { x: -10, y: 0, width: 20, height: 4, fill: '#d09272' }),
        h('rect', { x: -2, y: -17, width: 4, height: 18, fill: '#50785a' }),
        h('rect', { x: -12, y: -13, width: 11, height: 6, fill: '#5d9471' }),
        h('rect', { x: 1, y: -19, width: 10, height: 7, fill: '#70a780' }),
        h('rect', { x: -7, y: -23, width: 9, height: 8, fill: '#6ea27b' }),
        h('rect', { x: 3, y: -10, width: 12, height: 6, fill: '#4b8063' }))
    }

    function StudioView({ projects, activeId, onActive, onOpen, onOpenPath, onRefresh, onScene, tr, query, setQuery, roomId, setRoomId, camera, setCamera }) {
      const [mediaPicker, setMediaPicker] = useState(false)
      const [entering, setEntering] = useState('')
      const [inspectorOpen, setInspectorOpen] = useState(false)
      const viewportRef = useRef(null)
      const dragRef = useRef(null)
      const suppressClickRef = useRef(0)
      const lastFitRef = useRef(null)
      const enterTimerRef = useRef(0)
      const visibleProjects = useMemo(() => {
        const needle = String(query || '').trim().toLowerCase()
        if (!needle) return projects
        return projects.filter((project) =>
          String(project.displayName || project.name || '').toLowerCase().includes(needle)
          || String(project.path || '').toLowerCase().includes(needle)
          || String(project.note || project.summary || '').toLowerCase().includes(needle)
          || (project.tags || []).some((tag) => String(tag).toLowerCase().includes(needle)))
      }, [projects, query])
      const active = visibleProjects.find((project) => project.id === activeId) || null
      const activeMedia = useProjectMedia(active?.id, active?.representativeImage?.path || '')
      const cover = activeMedia.data?.representative || activeMedia.data?.items?.[0] || null
      const reduced = earthReduced()

      const rooms = useMemo(() => studioRooms(projects, visibleProjects, tr), [projects, visibleProjects, tr])

      const room = roomId === 'overview' ? null : rooms.find((item) => item.id === roomId) || null
      const activeRoom = active ? rooms.find((item) => item.projects.some((project) => project.id === active.id)) || null : null
      const cameraState = {
        x: Number(camera?.x) || 0,
        y: Number(camera?.y) || 0,
        z: Math.max(0.25, Math.min(1.4, Number(camera?.z) || 1)),
      }

      useEffect(() => {
        if (roomId !== 'overview' && !rooms.some((item) => item.id === roomId)) setRoomId('overview')
      }, [roomId, rooms, setRoomId])

      useEffect(() => {
        const handleKey = (event) => {
          if (event.key !== 'Escape' || mediaPicker) return
          if (roomId !== 'overview') {
            setRoomId('overview')
            const fit = fitZoom()
            lastFitRef.current = fit
            setCamera({ x: 0, y: 0, z: fit })
            return
          }
          if (activeId) onActive('')
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
      }, [roomId, activeId, mediaPicker, onActive, setRoomId, setCamera])

      useEffect(() => {
        const node = viewportRef.current
        if (!node) return undefined
        const wheel = (event) => {
          event.preventDefault()
          const step = event.deltaY > 0 ? -0.055 : 0.055
          setCamera((previous) => {
            const z = Math.max(0.25, Math.min(1.4, (Number(previous?.z) || 1) + step))
            return { x: Number(previous?.x) || 0, y: Number(previous?.y) || 0, z }
          })
        }
        node.addEventListener('wheel', wheel, { passive: false })
        return () => node.removeEventListener('wheel', wheel)
      }, [setCamera])

      const fitZoom = () => {
        const node = viewportRef.current
        const width = Math.max(320, (node?.clientWidth || 1040) - 16)
        const height = Math.max(280, (node?.clientHeight || 600) - 16)
        const vertical = (height - 18) / 600
        return Math.max(0.25, Math.min(1, width / 1040, vertical))
      }

      useEffect(() => {
        const node = viewportRef.current
        if (!node) return
        const fit = fitZoom()
        lastFitRef.current = fit
        const current = Number(camera?.z) || 1
        if (current === 1 && !Number(camera?.x) && !Number(camera?.y) && fit < 0.98) {
          setCamera({ x: 0, y: 0, z: fit })
        }
      }, [])

      useEffect(() => {
        const node = viewportRef.current
        if (!node || typeof ResizeObserver === 'undefined') return undefined
        let frame = 0
        let first = true
        const sync = () => {
          if (first) { first = false; return }
          cancelAnimationFrame(frame)
          frame = requestAnimationFrame(() => {
            const fit = fitZoom()
            setCamera((previous) => {
              const x = Number(previous?.x) || 0
              const y = Number(previous?.y) || 0
              const z = Number(previous?.z) || 1
              if (Math.abs(x) < 2 && Math.abs(y) < 2 && lastFitRef.current != null && Math.abs(z - lastFitRef.current) < 0.02) {
                lastFitRef.current = fit
                return { x: 0, y: 0, z: fit }
              }
              return previous
            })
          })
        }
        const observer = new ResizeObserver(sync)
        observer.observe(node)
        window.addEventListener('resize', sync)
        return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', sync) }
      }, [])

      const updateZoom = (delta) => {
        setCamera((previous) => {
          const z = Math.max(0.25, Math.min(1.4, (Number(previous?.z) || 1) + delta))
          return { x: Number(previous?.x) || 0, y: Number(previous?.y) || 0, z }
        })
      }

      const pointerDown = (event) => {
        // On small touch screens, use the native scroll container rather than
        // updating a desktop camera transform that the mobile layout ignores.
        if (event.pointerType === 'touch' && event.currentTarget?.clientWidth <= 760) return
        if (event.button !== 0) return
        dragRef.current = {
          pointerId: event.pointerId, x: event.clientX, y: event.clientY,
          left: cameraState.x, top: cameraState.y, moved: false,
        }
      }

      const pointerMove = (event) => {
        const drag = dragRef.current
        if (!drag || drag.pointerId !== event.pointerId) return
        const dx = event.clientX - drag.x
        const dy = event.clientY - drag.y
        if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true
        if (!drag.moved) return
        event.preventDefault()
        setCamera((previous) => ({
          x: drag.left + dx, y: drag.top + dy,
          z: Math.max(0.25, Math.min(1.4, Number(previous?.z) || 1)),
        }))
      }

      const pointerUp = (event) => {
        const drag = dragRef.current
        if (!drag || drag.pointerId !== event.pointerId) return
        if (drag.moved) suppressClickRef.current = Date.now() + 260
        dragRef.current = null
      }

      const guardClick = (callback) => {
        if (Date.now() < suppressClickRef.current) return
        callback()
      }

      const enterRoom = (next) => {
        guardClick(() => {
          setRoomId(next.id)
          const fit = fitZoom()
          lastFitRef.current = fit
          setCamera({ x: 0, y: 0, z: fit })
          if (!active || !next.projects.some((project) => project.id === active.id)) onActive(next.projects[0]?.id || '')
        })
      }

      const leaveRoom = () => {
        setRoomId('overview')
        const fit = fitZoom()
        lastFitRef.current = fit
        setCamera({ x: 0, y: 0, z: fit })
      }

      const chooseRepresentative = async (item) => {
        if (!active) return { ok: false, error: tr('earthMediaFailed') }
        try {
          const response = await fetch(API + '/override', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              id: active.id,
              patch: { representativeImage: item ? { path: item.path, folder: item.folder, title: item.title } : null },
            }),
          })
          const data = await response.json().catch(() => ({}))
          if (!response.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + response.status))
          invalidateProjectMedia(active.id)
          await activeMedia.reload()
          onRefresh?.()
          return { ok: true }
        } catch (error) { return { ok: false, error: error?.message || String(error) } }
      }

      const runtimeText = (project) => project.runtime?.state
        ? tr(RUNTIME_STATE_KEYS[project.runtime.state] || 'runtimeUnknown')
        : tr('sceneStudioUnknown')

      const mediaEmptyText = activeMedia.status === 'loading'
        ? tr('sceneStudioMediaLoading')
        : activeMedia.status === 'error'
          ? tr('sceneStudioMediaFailed')
          : tr('sceneStudioNoImage')

      useEffect(() => () => {
        if (enterTimerRef.current) clearTimeout(enterTimerRef.current)
      }, [])

      const enterProject = (project) => {
        if (!project || entering) return
        if (reduced) { onOpen(project); return }
        setEntering(project.id)
        enterTimerRef.current = setTimeout(() => {
          enterTimerRef.current = 0
          setEntering('')
          onOpen(project)
        }, 260)
      }

      const renderDesk = (project, roomKind) => {
        const thumbnail = (project.runtime?.artifacts || []).find((artifact) => artifact.kind === 'image' && artifact.url) || null
        return h('button', {
          key: project.id, type: 'button',
          className: cx('wb-studio-desk', roomKind === 'offices' && 'is-office', project.id === activeId && 'is-active'),
          'data-project-id': project.id,
          'aria-pressed': project.id === activeId,
          title: `${project.displayName || project.name} · ${tr('sceneStudioRoomHint')}`,
          onClick: () => guardClick(() => { onActive(project.id); setInspectorOpen(true) }),
          onDoubleClick: () => guardClick(() => enterProject(project)),
        },
          h('span', { className: 'wb-studio-desk-top' },
            h('span', { className: 'wb-studio-desk-lamp' }),
            h('span', { className: 'wb-studio-desk-code' }, project.pinned ? '★' : projectMark(project))),
          thumbnail
            ? h(MediaImage, { item: thumbnail, className: 'wb-studio-desk-image', alt: project.displayName || project.name })
            : h('span', { className: 'wb-studio-desk-image-empty', 'aria-hidden': 'true' },
                h('b', { className: 'wb-studio-desk-monogram' }, String(project.displayName || project.name || '?').trim().slice(0, 1)),
                h(Glyph, { name: 'image', size: 15 }),
                h('span', null, tr('sceneStudioNoImage'))),
          h('span', { className: 'wb-studio-desk-name' }, project.displayName || project.name),
          h('span', { className: 'wb-studio-desk-meta' }, lifecycleLabel(project.lifecycle, tr), ' · ', statusLabel(project.status, tr), ' · ', runtimeText(project)),
          h('span', { className: 'wb-studio-desk-foot' },
            h('span', null, String(project.sessionCount || 0) + ' ' + tr('sessions')),
            h('span', null, relTime(project.lastActivity, tr))))
      }

      const wingLayouts = [
        { x: 38, y: 96, w: 466, h: 198 },
        { x: 536, y: 96, w: 466, h: 198 },
        { x: 38, y: 324, w: 466, h: 232 },
        { x: 536, y: 324, w: 466, h: 232 },
      ]
      const wingKinds = [
        { kind: 'offices', code: 'A', label: tr('sceneStudioPersistent') },
        { kind: 'workshop', code: 'B', label: tr('sceneStudioIncubating') },
        { kind: 'shared', code: 'C', label: tr('sceneStudioTemporary') },
        { kind: 'intake', code: 'D', label: tr('sceneStudioUnclassified') },
      ]
      const wings = wingKinds.map((wing, index) => {
        const wingRooms = rooms.filter((item) => item.kind === wing.kind)
        return { ...wing, index, rooms: wingRooms, projects: wingRooms.flatMap((item) => item.projects) }
      }).filter((wing) => wing.projects.length)
      const lifecycleSummary = wingKinds.map((wing) => ({
        kind: wing.kind,
        label: wing.label,
        count: wings.find((item) => item.kind === wing.kind)?.projects.length || 0,
      }))
      const activeWing = active ? wings.find((wing) => wing.projects.some((project) => project.id === active.id)) || null : null

      const enterWing = (wing) => {
        if (!wing?.rooms.length) return
        const preferred = wing.rooms.find((item) => active && item.projects.some((project) => project.id === active.id)) || wing.rooms[0]
        enterRoom(preferred)
      }

      const shortName = (project, limit = 10) => {
        const name = String(project.displayName || project.name || '')
        return name.length > limit ? name.slice(0, limit) + '…' : name
      }

      const miniDesk = (project, x, y, w, rh) => h('g', {
        key: project.id,
        className: cx('wb-atelier-mini-desk', atelierTone(project), project.id === activeId && 'is-active'),
        transform: `translate(${x} ${y})`,
      },
        h('rect', { className: 'wb-atelier-mini-shadow', x: 2, y: 4, width: w, height: rh, rx: 3 }),
        h('rect', { className: 'wb-atelier-mini-table', x: 0, y: 0, width: w, height: rh, rx: 3 }),
        h('rect', { className: 'wb-atelier-mini-screen', x: w * 0.18, y: 4, width: w * 0.38, height: rh * 0.34, rx: 1.5 }),
        h('path', { d: `M${w * 0.22} 8 h${w * 0.18} M${w * 0.22} 11 h${w * 0.12}`, stroke: '#a9c9c5', strokeWidth: 1, fill: 'none', 'aria-hidden': 'true' }),
        h('rect', { x: w * .26, y: rh * .54, width: w * .26, height: 3, fill: '#f6e8ce', 'aria-hidden': 'true' }),
        h('rect', { className: 'wb-atelier-mini-paper', x: w * 0.62, y: 7, width: w * 0.2, height: rh * 0.24, rx: 1 }),
        h(OfficePixelPerson, { x: w * 0.5, y: rh + 8, tone: atelierTone(project), seated: true, scale: 0.56 }),
        h('circle', { className: cx('wb-atelier-state-dot', atelierTone(project)), cx: w - 4, cy: 4, r: 2.5 }))

      const wingFurniture = (wing, w, rh) => {
        if (wing.kind === 'offices') {
          return [
            h('rect', { key: 'c1', className: 'wb-atelier-cabin', x: 18, y: 32, width: 205, height: rh - 54, rx: 2 }),
            h('rect', { key: 'c2', className: 'wb-atelier-cabin', x: 243, y: 32, width: 205, height: rh - 54, rx: 2 }),
            h('path', { key: 'g1', className: 'wb-atelier-glass', d: `M223 34 V${rh - 24} M448 34 V${rh - 24}` }),
            h('path', { key: 'g2', className: 'wb-atelier-glass', d: `M20 ${rh * 0.44} H223 M245 ${rh * 0.44} H448` }),
            h('rect', { key: 'p1', className: 'wb-atelier-plant-pot', x: 34, y: rh - 38, width: 13, height: 10, rx: 2 }),
            h('path', { key: 'p2', className: 'wb-atelier-plant-leaf', d: `M40 ${rh - 38} C28 ${rh - 71} 43 ${rh - 78} 48 ${rh - 46} C58 ${rh - 70} 66 ${rh - 52} 47 ${rh - 36}` }),
          ]
        }
        if (wing.kind === 'workshop') {
          return [
            h('rect', { key: 'wb', className: 'wb-atelier-whiteboard', x: 18, y: 26, width: 238, height: 34, rx: 2 }),
            h('path', { key: 'wbl', className: 'wb-atelier-whiteboard-line', d: 'M31 38 H146 M31 48 H204 M158 38 H218' }),
            h('rect', { key: 'bench', className: 'wb-atelier-bench', x: 20, y: rh - 58, width: w - 40, height: 20, rx: 2 }),
            h('path', { key: 'benchline', className: 'wb-atelier-bench-line', d: `M32 ${rh - 48} H${w - 34}` }),
            h('circle', { key: 'cup1', className: 'wb-atelier-cup', cx: w - 62, cy: rh - 66, r: 4 }),
            h('circle', { key: 'cup2', className: 'wb-atelier-cup', cx: w - 48, cy: rh - 66, r: 4 }),
          ]
        }
        if (wing.kind === 'shared') {
          return [
            h('rect', { key: 'locker', className: 'wb-atelier-locker', x: 18, y: 34, width: 44, height: rh - 92, rx: 2 }),
            h('path', { key: 'lockerline', className: 'wb-atelier-locker-line', d: `M18 ${rh * 0.36} H62 M18 ${rh * 0.58} H62 M18 ${rh * 0.8} H62` }),
            h('rect', { key: 'commons', className: 'wb-atelier-commons', x: 78, y: 36, width: w - 100, height: 38, rx: 3 }),
            h('path', { key: 'commonsline', className: 'wb-atelier-commons-line', d: `M96 ${rh * 0.34} H${w - 28}` }),
            h('circle', { key: 'plate', className: 'wb-atelier-plate', cx: w - 55, cy: 55, r: 8 }),
          ]
        }
        return [
          h('rect', { key: 'shelf', className: 'wb-atelier-archive', x: 18, y: 30, width: w - 36, height: 42, rx: 2 }),
          h('path', { key: 'shelfline', className: 'wb-atelier-archive-line', d: `M26 44 H${w - 44} M26 56 H${w - 44}` }),
          h('rect', { key: 'box1', className: 'wb-atelier-box', x: 34, y: rh - 64, width: 54, height: 38, rx: 2 }),
          h('rect', { key: 'box2', className: 'wb-atelier-box is-low', x: 96, y: rh - 54, width: 44, height: 28, rx: 2 }),
          h('path', { key: 'boxline', className: 'wb-atelier-box-line', d: `M43 ${rh - 55} H79 M43 ${rh - 47} H68 M105 ${rh - 46} H131` }),
        ]
      }

      const renderWing = (wing) => {
        const layout = wingLayouts[wing.index] || wingLayouts[0]
        const { x, y, w, h: rh } = layout
        const samples = wing.projects.slice(0, wing.kind === 'offices' ? 2 : 16)
        const cols = wing.kind === 'offices' ? 2 : 4
        const deskW = wing.kind === 'offices' ? 62 : 40
        const deskH = wing.kind === 'offices' ? 32 : 23
        const startX = wing.kind === 'offices' ? 44 : 30
        const startY = wing.kind === 'offices' ? 58 : 76
        const gapX = wing.kind === 'offices' ? 217 : Math.max(52, (w - 48) / cols)
        const gapY = wing.kind === 'offices' ? 94 : 30
        return h('g', {
          key: wing.kind,
          className: cx('wb-atelier-wing', `is-${wing.kind}`, activeWing?.kind === wing.kind && 'has-active'),
          transform: `translate(${x} ${y})`,
          role: 'button',
          tabIndex: 0,
          'aria-label': `${wing.label}, ${wing.projects.length} ${tr('projects')}, ${wing.rooms.length} ${tr('sceneStudioFloor')}`,
          title: wing.label + ' · ' + tr('sceneStudioOpenWing'),
          onClick: () => guardClick(() => enterWing(wing)),
          onKeyDown: (event) => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); guardClick(() => enterWing(wing)) }
          },
        },
          h('rect', { className: 'wb-atelier-wing-shadow', x: 10, y: 12, width: w, height: rh, rx: 4 }),
          h('path', { className: 'wb-atelier-wing-floor', d: `M0 18 H${w} L${w - 15} ${rh} H15 Z` }),
          h('rect', { x: 20, y: 20, width: w - 40, height: rh - 26, fill: 'url(#wbAtelierPlanks)', opacity: .35, pointerEvents: 'none' }),
          h('ellipse', { className: 'wb-atelier-wing-light', cx: w * 0.52, cy: rh * 0.52, rx: w * 0.42, ry: rh * 0.42 }),
          h('path', { className: 'wb-atelier-wing-wall', d: `M0 18 H${w} V0 H0 Z` }),
          h('path', { className: 'wb-atelier-wing-side', d: `M0 18 V${rh} H15 L0 18` }),
          h('path', { className: 'wb-atelier-wing-bottom', d: `M15 ${rh} H${w * 0.38} M${w * 0.62} ${rh} H${w - 15}` }),
          h('rect', { className: 'wb-atelier-door-glow', x: w * 0.38, y: rh - 3, width: w * 0.24, height: 5, rx: 1 }),
          Array.from({ length: 5 }).map((_, index) => h('rect', {
            key: 'win' + index, className: 'wb-atelier-window',
            x: 24 + index * ((w - 48) / 5), y: 5, width: (w - 72) / 5, height: 9, rx: 1,
          })),
          [0.27, 0.73].map((ratio, index) => h('g', { key: 'lamp' + index, className: 'wb-atelier-pendant' },
            h('path', { className: 'wb-atelier-pendant-line', d: `M${w * ratio} 16 V34` }),
            h('ellipse', { className: 'wb-atelier-pendant-shade', cx: w * ratio, cy: 36, rx: 11, ry: 4 }),
            h('ellipse', { className: 'wb-atelier-pendant-glow', cx: w * ratio, cy: 52, rx: 30, ry: 16 }))),
          h('path', { className: 'wb-atelier-floor-rule', d: `M18 ${rh - 34} H${w - 18} M18 ${rh - 64} H${w - 18} M18 ${rh - 94} H${w - 18}` }),
          wingFurniture(wing, w, rh),
          h(OfficePixelPlant, { x: w - 20, y: rh - 27, scale: .68 }),
          samples.map((project, index) => miniDesk(project, startX + (index % cols) * gapX, startY + Math.floor(index / cols) * gapY, deskW, deskH)),
          wing.kind === 'offices'
            ? h(OfficePixelPerson, { x: 126, y: rh - 58, tone: 'is-idle', scale: 1.08 })
            : h(OfficePixelPerson, { x: w - 54, y: rh - 86, tone: atelierTone(samples[0] || {}), scale: 1.02 }),
          wing.kind !== 'offices'
            ? h(OfficePixelPerson, { x: w * 0.33, y: rh - 42, tone: 'is-idle', scale: 0.9 })
            : null,
          wing.kind !== 'offices'
            ? h('g', { className: 'wb-atelier-stroller' }, h(OfficePixelPerson, { x: 70, y: rh - 46, tone: 'is-idle', scale: 0.9, walking: true }))
            : null,
          h('g', { className: 'wb-atelier-plaque', transform: 'translate(14 14)' },
            h('rect', { className: 'wb-atelier-plaque-bg', x: 0, y: 0, width: 310, height: 38, rx: 2 }),
            h('text', { className: 'wb-atelier-plaque-code', x: 10, y: 25 }, wing.code),
            h('text', { className: 'wb-atelier-plaque-name', x: 39, y: 16 }, wing.label),
            h('text', { className: 'wb-atelier-plaque-meta', x: 39, y: 30 },
              String(wing.projects.length), ' ', tr('sceneStudioDeskCount'), ' · ', String(wing.rooms.length), ' ', tr('sceneStudioFloor'))),
          h('path', { className: 'wb-atelier-wing-arrow', d: `M${w - 32} ${rh - 22} l10 -7 v14 z` }))
      }

      const roomTabs = room ? rooms.filter((item) => item.kind === room.kind) : []
      const roomDeskLayout = studioDeskLayout(room?.projects.length || 0)

      const renderRoomDesk = (project, index) => {
        const { cols, left, top, cellW, cellH, deskW, deskH } = roomDeskLayout
        const x = left + (index % cols) * cellW + cellW / 2
        const y = top + Math.floor(index / cols) * cellH + cellH / 2
        const tone = atelierTone(project)
        const name = shortName(project, roomDeskLayout.count > 20 ? 7 : 8)
        return h('g', {
          key: project.id,
          className: cx('wb-atelier-desk', tone, project.id === activeId && 'is-active'),
          transform: `translate(${x} ${y})`,
          role: 'button',
          tabIndex: 0,
          'aria-pressed': project.id === activeId,
          'aria-label': `${project.displayName || project.name} · ${tr('sceneStudioDesk')}`,
          title: `${project.displayName || project.name} · ${tr('sceneStudioRoomHint')}`,
          onClick: () => guardClick(() => { onActive(project.id); setInspectorOpen(true) }),
          onDoubleClick: () => guardClick(() => enterProject(project)),
          onKeyDown: (event) => {
            if (event.key === 'Enter') { event.preventDefault(); guardClick(() => enterProject(project)) }
            else if (event.key === ' ') { event.preventDefault(); guardClick(() => { onActive(project.id); setInspectorOpen(true) }) }
          },
        },
          h('rect', { className: 'wb-atelier-desk-shadow', x: -deskW / 2 + 4, y: -deskH / 2 + 5, width: deskW, height: deskH, rx: 3 }),
          h('rect', { className: 'wb-atelier-desk-top', x: -deskW / 2, y: -deskH / 2, width: deskW, height: deskH, rx: 3 }),
          h('rect', { className: 'wb-atelier-desk-back', x: -deskW / 2, y: -deskH / 2 - 3, width: deskW, height: 5, rx: 1.5 }),
          h('rect', { className: 'wb-office-nameplate', x: -deskW / 2 + 2, y: -deskH / 2 + 2, width: deskW - 4, height: 16, rx: 1 }),
          h('text', { className: 'wb-atelier-desk-name', x: -deskW / 2 + 6, y: -deskH / 2 + 14 }, name),
          h('rect', { className: 'wb-atelier-desk-screen', x: -deskW * 0.23, y: -deskH / 2 + 21, width: deskW * 0.4, height: deskH * 0.25, rx: 1 }),
          h('path', { d: `M${-deskW * .19} ${-deskH / 2 + 25} h${deskW * .21} M${-deskW * .19} ${-deskH / 2 + 29} h${deskW * .13}`, stroke: '#a9c9c5', strokeWidth: 1, fill: 'none', 'aria-hidden': 'true' }),
          h('rect', { className: 'wb-atelier-desk-paper', x: deskW * 0.2, y: -deskH / 2 + 21, width: deskW * 0.17, height: deskH * 0.22, rx: 1 }),
          h('path', { d: `M${deskW * .22} ${-deskH / 2 + 25} h${deskW * .1} M${deskW * .22} ${-deskH / 2 + 29} h${deskW * .07}`, stroke: '#bbab90', strokeWidth: 1, fill: 'none', 'aria-hidden': 'true' }),
          h('rect', { className: 'wb-atelier-desk-keyboard', x: -deskW * 0.12, y: deskH * 0.1, width: deskW * 0.3, height: 4, rx: 1 }),
          h('circle', { className: 'wb-atelier-state-dot', cx: deskW / 2 - 5, cy: -deskH / 2 + 5, r: 2.8 }),
          h('rect', { className: 'wb-atelier-chair', x: -8, y: deskH / 2 + 2, width: 16, height: 8, rx: 3 }),
          h(OfficePixelPerson, { x: 0, y: deskH / 2 + (roomDeskLayout.count > 20 ? 5 : 9), tone, variant: index, seated: true, scale: roomDeskLayout.count > 20 ? 0.72 : 1.02 }),
          project.id === activeId ? h('rect', { className: 'wb-atelier-desk-focus', x: -deskW / 2 - 3, y: -deskH / 2 - 3, width: deskW + 6, height: deskH + 6, rx: 5 }) : null)
      }

      const coffeeCorner = h('g', { className: 'wb-atelier-pantry', transform: 'translate(786 82)' },
        h('rect', { className: 'wb-atelier-pantry-floor', x: 0, y: 0, width: 220, height: 480, rx: 3 }),
        h('ellipse', { className: 'wb-atelier-pantry-light', cx: 110, cy: 196, rx: 104, ry: 170 }),
        h('rect', { className: 'wb-atelier-pantry-wall', x: 0, y: 0, width: 220, height: 14 }),
        h('rect', { className: 'wb-atelier-counter', x: 18, y: 28, width: 184, height: 44, rx: 3 }),
        h('rect', { className: 'wb-atelier-fridge', x: 174, y: 30, width: 26, height: 54, rx: 2 }),
        h('path', { className: 'wb-atelier-fridge-line', d: 'M174 52 H200 M187 36 V47' }),
        h('rect', { className: 'wb-atelier-shelf', x: 18, y: 84, width: 52, height: 5, rx: 1 }),
        h('rect', { className: 'wb-atelier-shelf', x: 18, y: 106, width: 52, height: 5, rx: 1 }),
        h('circle', { className: 'wb-atelier-jar', cx: 28, cy: 80, r: 3 }),
        h('circle', { className: 'wb-atelier-jar', cx: 38, cy: 80, r: 3 }),
        h('circle', { className: 'wb-atelier-jar', cx: 48, cy: 80, r: 3 }),
        h('circle', { className: 'wb-atelier-jar', cx: 30, cy: 102, r: 3 }),
        h('circle', { className: 'wb-atelier-jar', cx: 41, cy: 102, r: 3 }),
        h('rect', { className: 'wb-atelier-coffee', x: 126, y: 34, width: 30, height: 26, rx: 2 }),
        h('circle', { className: 'wb-atelier-coffee-dot', cx: 141, cy: 47, r: 2 }),
        h('path', { className: 'wb-atelier-cup', d: 'M42 42 h12 v9 h-12z M54 45 q8 0 0 7' }),
        h('path', { className: 'wb-atelier-cup', d: 'M72 42 h12 v9 h-12z M84 45 q8 0 0 7' }),
        h('path', { className: 'wb-atelier-steam', d: 'M137 29 c-7 -11 8 -14 1 -26 M147 29 c-7 -11 8 -14 1 -26' }),
        h('circle', { className: 'wb-atelier-stool', cx: 52, cy: 112, r: 12 }),
        h('circle', { className: 'wb-atelier-stool', cx: 108, cy: 112, r: 12 }),
        h('rect', { className: 'wb-atelier-pantry-table', x: 76, y: 154, width: 86, height: 54, rx: 3 }),
        h('path', { className: 'wb-atelier-pantry-table-line', d: 'M88 168 H148 M88 180 H136' }),
        h('rect', { x: 25, y: 270, width: 170, height: 101, fill: '#bbab8f', stroke: '#d9cdb0', strokeWidth: 3 }),
        h('rect', { x: 46, y: 286, width: 128, height: 44, fill: '#728f88', stroke: '#496c66', strokeWidth: 3 }),
        h('rect', { x: 51, y: 290, width: 55, height: 24, fill: '#94b1a5' }),
        h('rect', { x: 114, y: 290, width: 55, height: 24, fill: '#94b1a5' }),
        h('rect', { x: 67, y: 342, width: 86, height: 19, fill: '#e4c79c', stroke: '#987b5e', strokeWidth: 2 }),
        h('rect', { x: 87, y: 347, width: 22, height: 7, fill: '#f7ead0' }),
        h('rect', { x: 121, y: 347, width: 8, height: 8, fill: '#bd846d' }),
        h(OfficePixelPlant, { x: 184, y: 390, scale: 1.1 }),
        h(OfficePixelPerson, { x: 160, y: 206, tone: 'is-idle', scale: 1.15 }),
        h(OfficePixelPerson, { x: 38, y: 206, tone: 'is-idle', scale: 1 }),
        h('rect', { className: 'wb-atelier-plant-pot', x: 22, y: 406, width: 22, height: 18, rx: 2 }),
        h('path', { className: 'wb-atelier-plant-leaf', d: 'M33 408 C8 366 28 344 40 388 C58 342 76 370 48 414' }),
        h('text', { className: 'wb-atelier-pantry-label', x: 110, y: 458, textAnchor: 'middle' }, tr('sceneStudioPantry')),
        h('text', { className: 'wb-atelier-pantry-note', x: 110, y: 468, textAnchor: 'middle' }, tr('sceneStudioSchematic')))

      const renderOverview = () => h('svg', {
        className: 'wb-atelier-svg',
        viewBox: '0 0 1040 600',
        role: 'img',
        'aria-label': `${tr('sceneStudioTitle')} · ${String(visibleProjects.length)} ${tr('projects')}`,
      },
        h('defs', null,
          h('linearGradient', { id: 'wbAtelierFloor', x1: '0', y1: '0', x2: '0', y2: '1' },
            h('stop', { offset: '0', stopColor: '#463c2e' }),
            h('stop', { offset: '1', stopColor: '#241f18' })),
          h('radialGradient', { id: 'wbAtelierLamp', cx: '50%', cy: '46%', r: '58%' },
            h('stop', { offset: '0', stopColor: 'rgba(229,199,142,.16)' }),
            h('stop', { offset: '0.58', stopColor: 'rgba(221,190,132,.06)' }),
            h('stop', { offset: '1', stopColor: 'rgba(221,190,132,0)' })),
          h('pattern', { id: 'wbAtelierGrid', width: 28, height: 28, patternUnits: 'userSpaceOnUse' },
            h('path', { d: 'M28 0 H0 V28', fill: 'none', stroke: 'rgba(184,208,187,.035)', strokeWidth: 1 })),
          h('pattern', { id: 'wbAtelierPlanks', width: 112, height: 26, patternUnits: 'userSpaceOnUse' },
            h('path', { d: 'M0 26 H112 M56 0 V26 M0 0 V26', fill: 'none', stroke: 'rgba(80,54,30,.3)', strokeWidth: 1 }))),
        h('rect', { className: 'wb-atelier-backdrop', x: 0, y: 0, width: 1040, height: 600 }),
        h('rect', { className: 'wb-atelier-room-floor', x: 20, y: 72, width: 1000, height: 508, rx: 4 }),
        h('rect', { className: 'wb-atelier-planks', x: 20, y: 72, width: 1000, height: 508, fill: 'url(#wbAtelierPlanks)' }),
        h('path', { className: 'wb-atelier-corridor', d: 'M20 302 H1020 V324 H20 Z' }),
        h('text', { className: 'wb-atelier-corridor-label', x: 32, y: 317 }, tr('sceneStudioCorridor')),
        h('path', { className: 'wb-atelier-corridor-line', d: 'M220 313 H716' }),
        h('g', { className: 'wb-atelier-walker is-corridor' }, h(OfficePixelPerson, { x: 450, y: 314, tone: 'is-idle', scale: 0.82, walking: true })),
        wings.length
          ? wings.map(renderWing)
          : h('g', null,
              h('text', { className: 'wb-atelier-empty-title', x: 520, y: 280, textAnchor: 'middle' }, tr('sceneStudioNoMatch')),
              h('text', { className: 'wb-atelier-empty-copy', x: 520, y: 302, textAnchor: 'middle' }, tr('sceneStudioSearch'))),
        h('g', { className: 'wb-atelier-overview-pantry', transform: 'translate(890 330)' },
          h('rect', { className: 'wb-atelier-counter', x: 0, y: 0, width: 98, height: 28, rx: 2 }),
          h('rect', { className: 'wb-atelier-coffee', x: 58, y: 4, width: 20, height: 18, rx: 1.5 }),
          h('path', { className: 'wb-atelier-steam', d: 'M68 0 c-4 -7 5 -8 1 -16 M75 0 c-4 -7 5 -8 1 -16' }),
          h('text', { className: 'wb-atelier-pantry-label', x: 49, y: 43, textAnchor: 'middle' }, tr('sceneStudioPantry'))),
        h('text', { className: 'wb-atelier-legend-note', x: 32, y: 570 }, tr('sceneStudioSpatialNote')),
        h('g', { className: 'wb-atelier-legend', transform: 'translate(760 560)' },
          h('circle', { className: 'wb-atelier-state-dot is-running', cx: 0, cy: 0, r: 3 }),
          h('text', { x: 8, y: 3 }, tr('runtimeRunning')),
          h('circle', { className: 'wb-atelier-state-dot is-waiting', cx: 72, cy: 0, r: 3 }),
          h('text', { x: 80, y: 3 }, tr('runtimeWaiting')),
          h('circle', { className: 'wb-atelier-state-dot is-idle', cx: 142, cy: 0, r: 3 }),
          h('text', { x: 150, y: 3 }, tr('runtimeUnknown'))))

      const renderRoom = () => h('svg', {
        className: 'wb-atelier-svg is-room',
        viewBox: '0 0 1040 600',
        role: 'img',
        'aria-label': `${room.label} · ${String(room.projects.length)} ${tr('sceneStudioDeskCount')}`,
      },
        h('defs', null,
          h('linearGradient', { id: 'wbAtelierRoomFloor', x1: '0', y1: '0', x2: '0', y2: '1' },
            h('stop', { offset: '0', stopColor: room.kind === 'intake' ? '#443a2b' : '#3f3528' }),
            h('stop', { offset: '1', stopColor: room.kind === 'intake' ? '#241f18' : '#211c15' })),
          h('radialGradient', { id: 'wbAtelierRoomLamp', cx: '50%', cy: '48%', r: '56%' },
            h('stop', { offset: '0', stopColor: 'rgba(232,202,145,.2)' }),
            h('stop', { offset: '0.56', stopColor: 'rgba(218,188,130,.07)' }),
            h('stop', { offset: '1', stopColor: 'rgba(218,188,130,0)' })),
          h('pattern', { id: 'wbAtelierRoomGrid', width: 32, height: 32, patternUnits: 'userSpaceOnUse' },
            h('path', { d: 'M32 0 H0 V32', fill: 'none', stroke: 'rgba(197,218,199,.04)', strokeWidth: 1 })),
          h('pattern', { id: 'wbAtelierRoomPlanks', width: 112, height: 26, patternUnits: 'userSpaceOnUse' },
            h('path', { d: 'M0 26 H112 M56 0 V26 M0 0 V26', fill: 'none', stroke: 'rgba(80,54,30,.3)', strokeWidth: 1 }))),
        h('rect', { className: 'wb-atelier-backdrop', x: 0, y: 0, width: 1040, height: 600 }),
        h('rect', { className: 'wb-atelier-room-floor', x: 20, y: 64, width: 1000, height: 516, rx: 4 }),
        h('rect', { className: 'wb-atelier-planks', x: 20, y: 64, width: 1000, height: 516, fill: 'url(#wbAtelierRoomPlanks)' }),
        h('ellipse', { className: 'wb-atelier-room-light', cx: 420, cy: 338, rx: 430, ry: 250 }),
        h('rect', { className: 'wb-atelier-room-rug', x: 62, y: 112, width: 668, height: 426, rx: 5 }),
        h('path', { className: 'wb-atelier-wing-wall', d: 'M20 64 H1020 V28 H20 Z' }),
        h('path', { className: 'wb-atelier-room-sidewall', d: 'M20 64 V580 H36 V64 M1020 64 V580 H1004 V64' }),
        h('rect', { className: 'wb-atelier-room-bottomwall', x: 20, y: 574, width: 740, height: 10, rx: 1 }),
        h('rect', { className: 'wb-atelier-room-bottomwall', x: 842, y: 574, width: 178, height: 10, rx: 1 }),
        h('path', { className: 'wb-atelier-room-baseboard', d: 'M36 72 H1004 M36 574 H760' }),
        h('rect', { className: 'wb-atelier-room-door', x: 760, y: 566, width: 82, height: 8, rx: 1 }),
        Array.from({ length: 7 }).map((_, index) => h('rect', {
          key: 'roomwin' + index, className: 'wb-atelier-window',
          x: 48 + index * 132, y: 42, width: 92, height: 12, rx: 1,
        })),
        [250, 520, 720].map((x, index) => h('g', { key: 'roomlamp' + index, className: 'wb-atelier-pendant' },
          h('path', { className: 'wb-atelier-pendant-line', d: `M${x} 60 V110` }),
          h('ellipse', { className: 'wb-atelier-pendant-shade', cx: x, cy: 112, rx: 12, ry: 4 }),
          h('ellipse', { className: 'wb-atelier-pendant-glow', cx: x, cy: 126, rx: 38, ry: 20 }))),
        h('g', { transform: 'translate(44 76)' },
          h('rect', { className: 'wb-atelier-room-plaque', x: 0, y: 0, width: 380, height: 32, rx: 2 }),
          h('text', { className: 'wb-atelier-plaque-code', x: 10, y: 22 }, room.code),
          h('text', { className: 'wb-atelier-plaque-name', x: 42, y: 20 }, room.label),
          h('text', { className: 'wb-atelier-plaque-meta', x: 300, y: 20 }, String(room.projects.length), ' ', tr('sceneStudioDeskCount'))),
        h('path', { className: 'wb-atelier-room-aisle', d: 'M760 80 V556 M778 80 V556' }),
        h('g', { className: 'wb-atelier-wall-shelf', transform: 'translate(24 146)' },
          h('rect', { className: 'wb-atelier-shelf-back', x: 0, y: 0, width: 15, height: 218, rx: 2 }),
          h('path', { className: 'wb-atelier-shelf-line', d: 'M0 42 H15 M0 86 H15 M0 130 H15 M0 174 H15' }),
          Array.from({ length: 9 }).map((_, index) => h('rect', { key: 'book' + index, className: 'wb-atelier-book', x: 2 + (index % 2) * 4, y: 8 + Math.floor(index / 2) * 22, width: 3, height: 12, rx: .5 }))),
        h('g', { className: 'wb-atelier-printer', transform: 'translate(686 108)' },
          h('rect', { className: 'wb-atelier-printer-body', x: 0, y: 0, width: 34, height: 24, rx: 2 }),
          h('rect', { className: 'wb-atelier-printer-paper', x: 7, y: -4, width: 20, height: 5, rx: .5 }),
          h('circle', { className: 'wb-atelier-printer-dot', cx: 26, cy: 12, r: 1.4 })),
        roomDeskLayout.count <= 9 ? h('g', { 'aria-hidden': 'true', className: 'wb-office-room-details' },
          h('rect', { className: 'wb-office-partition', x: 58, y: 139, width: 105, height: 12 }),
          h('rect', { className: 'wb-office-partition-glass', x: 62, y: 141, width: 42, height: 8 }),
          h('rect', { className: 'wb-office-partition-glass', x: 111, y: 141, width: 46, height: 8 }),
          h('rect', { x: 61, y: 164, width: 88, height: 84, fill: '#a78c6f', stroke: '#806b54', strokeWidth: 3 }),
          h('rect', { x: 66, y: 169, width: 78, height: 18, fill: '#e3d1ac' }),
          h('rect', { x: 66, y: 191, width: 78, height: 18, fill: '#d3c19f' }),
          h('rect', { x: 66, y: 213, width: 78, height: 29, fill: '#e3d1ac' }),
          h('path', { d: 'M73 175 h12 v9 H73z M90 175 h11 v9 H90z M106 175 h14 v9 h-14z M72 199 h22 M101 199 h28 M72 222 h15 v14 H72z M93 222 h19 v14 H93z M118 222 h18 v14 h-18z', fill: '#9aab96', stroke: '#718c7e', strokeWidth: 1 }),
          h(OfficePixelPlant, { x: 102, y: 303, scale: 1.35 }),
          h('rect', { className: 'wb-office-partition', x: 660, y: 146, width: 77, height: 12 }),
          h('rect', { className: 'wb-office-partition-glass', x: 665, y: 148, width: 66, height: 8 }),
          h('rect', { x: 675, y: 176, width: 58, height: 86, fill: '#ede1c7', stroke: '#80998c', strokeWidth: 3 }),
          h('path', { d: 'M685 188 h36 M685 197 h24 M685 213 h35 M685 222 h21 M685 238 h34', stroke: '#8a9f91', strokeWidth: 3 }),
          h('rect', { className: 'wb-office-meeting-floor', x: 251, y: 457, width: 277, height: 87 }),
          h('rect', { className: 'wb-office-meeting-chair', x: 278, y: 465, width: 43, height: 17 }),
          h('rect', { className: 'wb-office-meeting-chair', x: 343, y: 465, width: 43, height: 17 }),
          h('rect', { className: 'wb-office-meeting-chair', x: 408, y: 465, width: 43, height: 17 }),
          h('rect', { className: 'wb-office-meeting-chair', x: 278, y: 520, width: 43, height: 17 }),
          h('rect', { className: 'wb-office-meeting-chair', x: 343, y: 520, width: 43, height: 17 }),
          h('rect', { className: 'wb-office-meeting-chair', x: 408, y: 520, width: 43, height: 17 }),
          h('rect', { className: 'wb-office-meeting-table', x: 274, y: 483, width: 231, height: 35 }),
          h('rect', { x: 300, y: 491, width: 29, height: 17, fill: '#f6ead2' }),
          h('path', { d: 'M305 496 h18 M305 501 h14 M305 505 h17', stroke: '#b9ab90', strokeWidth: 1 }),
          h('rect', { x: 359, y: 492, width: 9, height: 9, fill: '#c99576' }),
          h('rect', { x: 416, y: 491, width: 29, height: 17, fill: '#aec6b6' }),
          h('rect', { x: 456, y: 493, width: 9, height: 9, fill: '#e9d9b7' })) : null,
        h('g', { className: 'wb-atelier-room-plant', transform: 'translate(724 516)' },
          h('rect', { className: 'wb-atelier-plant-pot', x: -10, y: 0, width: 20, height: 16, rx: 2 }),
          h('path', { className: 'wb-atelier-plant-leaf', d: 'M0 2 C-22 -34 -4 -52 8 -18 C24 -50 40 -28 14 4' })),
        h('g', { className: 'wb-atelier-walker is-room' }, h(OfficePixelPerson, { x: 770, y: 248, tone: 'is-idle', scale: 1.05, walking: true })),
        room.projects.map(renderRoomDesk),
        coffeeCorner,
        h('text', { className: 'wb-atelier-room-note', x: 44, y: 570 }, tr('sceneStudioSpatialNote')))

      const overview = h(React.Fragment, null,
        h('div', { className: 'wb-atelier-scene' }, renderOverview()),
        h('div', { className: 'wb-atelier-legendbar' },
          lifecycleSummary.map((item) => h('span', { key: item.kind, className: `is-${item.kind}` },
            h('i'), item.label, ' ', h('b', null, String(item.count)))),
          h('span', { className: 'wb-atelier-legendbar-note' }, tr('sceneStudioAmbient'))))

      const detail = room ? h(React.Fragment, null,
        h('div', { className: 'wb-atelier-roombar' },
          h('button', { type: 'button', className: 'wb-atelier-back', onClick: leaveRoom }, '← ', tr('sceneStudioBackPlan')),
          h('div', { className: 'wb-atelier-roombar-title' },
            h('span', null, room.code),
            h('strong', null, room.label),
            h('small', null, String(room.projects.length) + ' ' + tr('sceneStudioDeskCount'))),
          h('div', { className: 'wb-atelier-tabs', role: 'tablist', 'aria-label': tr('sceneStudioFloor') },
            roomTabs.map((item) => h('button', {
              key: item.id, type: 'button', role: 'tab', 'aria-selected': item.id === room.id, 'aria-label': item.label, title: item.label,
              className: cx(item.id === room.id && 'is-current'),
              onClick: () => guardClick(() => setRoomId(item.id)),
            }, item.code))),
          h('button', { type: 'button', className: 'wb-scene-details-toggle', 'aria-expanded': inspectorOpen, onClick: () => setInspectorOpen((open) => !open) }, tr(inspectorOpen ? 'sceneHideDetails' : 'sceneShowDetails'))),
        h('div', { className: 'wb-atelier-scene is-room' }, renderRoom())) : null

      return h('div', { className: cx('wb-studio', 'wb-scene-enter', room && 'is-room', entering && 'is-entering', !inspectorOpen && 'is-inspector-collapsed') },
        h('header', { className: 'wb-studio-top' },
          h('div', { className: 'wb-studio-brand' },
            h('span', { className: 'wb-studio-mark' }, h(Glyph, { name: 'grid', size: 18 })),
            h('div', null,
              h('div', { className: 'wb-studio-overline' }, tr('sceneStudioKicker')),
              h('h1', null, tr('sceneStudioTitle')),
              h('p', null, tr('sceneStudioIntro')))),
          h('label', { className: 'wb-studio-search' },
            h(Glyph, { name: 'search', size: 14 }),
            h('input', { value: query, onChange: (event) => setQuery(event.target.value), placeholder: tr('sceneStudioSearch'), 'aria-label': tr('sceneStudioSearch') }))),
        h('div', { className: 'wb-studio-body' },
          h('section', { className: 'wb-studio-stage-wrap', 'aria-label': tr('sceneStudioTitle') },
            h('div', { className: 'wb-studio-stagebar' },
              h('div', { className: 'wb-studio-crumb' },
                h('span', null, tr('sceneStudioKicker')),
                h('b', null, room ? room.label : tr('sceneStudioOverview'))),
              h('span', { className: 'wb-studio-stage-count' }, String(visibleProjects.length), ' ', tr('projects'), ' · ', String(rooms.length), ' ', tr('sceneStudioRoomsCount')),
              h('button', { type: 'button', className: 'wb-scene-details-toggle', 'aria-expanded': inspectorOpen, onClick: () => setInspectorOpen((open) => !open) }, tr(inspectorOpen ? 'sceneHideDetails' : 'sceneShowDetails')),
              h('div', { className: 'wb-studio-zoom', role: 'group', 'aria-label': tr('sceneStudioZoom') },
                h('button', { type: 'button', onClick: () => updateZoom(-0.1), 'aria-label': tr('sceneStudioZoom') + ' −' }, '−'),
                h('span', null, Math.round(cameraState.z * 100) + '%'),
                h('button', { type: 'button', onClick: () => updateZoom(0.1), 'aria-label': tr('sceneStudioZoom') + ' +' }, '+'),
                h('button', { type: 'button', onClick: () => { const fit = fitZoom(); lastFitRef.current = fit; setCamera({ x: 0, y: 0, z: fit }) } }, tr('sceneStudioReset')))),
            h('div', {
              className: cx('wb-studio-viewport', room && 'is-room', reduced && 'is-reduced'),
              ref: viewportRef,
              tabIndex: 0,
              onPointerDown: pointerDown,
              onPointerMove: pointerMove,
              onPointerUp: pointerUp,
              onPointerLeave: pointerUp,
              'aria-label': tr('sceneStudioZoom'),
            },
              h('div', {
                className: 'wb-studio-plan wb-atelier-plan',
                style: { transform: `translate(${cameraState.x}px, ${cameraState.y}px) scale(${cameraState.z})` },
              }, room ? detail : overview))),
          room
            ? h('p', { className: 'wb-studio-mobile-pan' }, tr('sceneStudioMobilePan'))
            : h('nav', { className: 'wb-studio-mobile-nav', 'aria-label': tr('sceneStudioMobileRooms') },
              rooms.map((item) => h('button', { key: item.id, type: 'button', onClick: () => enterRoom(item) }, `${item.label} · ${item.projects.length}`))),
          h('aside', { className: 'wb-studio-inspector', 'aria-live': 'polite' },
            active ? h(React.Fragment, null,
              h('div', { className: 'wb-studio-inspector-overline' }, tr('sceneStudioSelected'), activeRoom ? ' · ' + activeRoom.label : ''),
              h('h2', null, active.displayName || active.name),
              h('p', { className: 'wb-studio-path', title: active.path }, active.path),
              h('div', { className: 'wb-studio-facts' },
                h('span', null, lifecycleLabel(active.lifecycle, tr)),
                h('span', null, statusLabel(active.status, tr)),
                h('span', null, runtimeText(active)),
                h('span', null, String(active.sessionCount || 0) + ' ' + tr('sessions'))),
              h('div', { className: 'wb-studio-photo' },
                cover
                  ? h(MediaImage, { item: cover, className: 'wb-studio-photo-image', alt: active.displayName || active.name })
                  : h('div', { className: 'wb-studio-photo-empty' }, h(Glyph, { name: 'image', size: 20 }), h('span', null, mediaEmptyText)),
                h('button', { type: 'button', className: 'wb-studio-photo-change', onClick: () => setMediaPicker(true) }, tr('earthMediaChange'))),
              activeMedia.data?.pinnedMissing ? h('p', { className: 'wb-anchor-warning' }, tr('earthMediaPinnedMissing')) : null,
              h('div', { className: 'wb-studio-record' },
                h('span', null, tr('sceneStudioRecent')),
                h('b', null, active.lastActivity ? fmtDate(active.lastActivity) + ' · ' + relTime(active.lastActivity, tr) : tr('sceneStudioNoRecord'))),
              h('p', { className: 'wb-studio-note' }, active.note || active.summary || tr('earthNoNote')),
              h('p', { className: 'wb-studio-evidence' }, h(Glyph, { name: 'alert', size: 11 }), tr('sceneStudioEvidence')),
              h('div', { className: 'wb-studio-actions' },
                h('button', { type: 'button', className: 'wb-btn primary', onClick: () => enterProject(active) }, tr('sceneStudioEnter'), ' ↗'),
                h('button', { type: 'button', className: 'wb-btn ghost', onClick: () => onOpen(active, 'capability') }, tr('earthAnchorCapability')),
                h('button', { type: 'button', className: 'wb-btn ghost', onClick: () => onOpen(active, 'outputs') }, tr('earthAnchorOutputs')),
                h('button', { type: 'button', className: 'wb-btn ghost', onClick: () => onOpen(active, 'sessions') }, tr('earthAnchorSessions')),
                active.path ? h('button', { type: 'button', className: 'wb-btn ghost', onClick: () => onOpenPath?.(active.path) }, tr('sceneStudioOpenFolder')) : null))
              : h('div', { className: 'wb-studio-inspector-empty' },
                h('span', { className: 'wb-studio-empty-mark' }, h(Glyph, { name: 'grid', size: 23 })),
                h('b', null, room ? room.label : tr('sceneStudioOverview')),
                h('p', null, room ? tr('sceneStudioRoomHint') : tr('sceneStudioSelectHint')),
                h('div', { className: 'wb-studio-mini-stats' },
                  h('span', null, String(visibleProjects.length), ' ', tr('projects')),
                  h('span', null, String(rooms.length), ' ', tr('sceneStudioRoomsCount'))),
                h('div', { className: 'wb-studio-legend' },
                  lifecycleSummary.map((item) => h('div', { key: item.kind, className: `is-${item.kind}` },
                    h('i'), h('span', null, item.label), h('b', null, String(item.count))))),
                h('p', { className: 'wb-studio-layout-note' }, tr('sceneStudioLayoutNote')))),
        mediaPicker && active ? h(ProjectMediaPicker, { project: active, tr, onClose: () => setMediaPicker(false), onApply: chooseRepresentative }) : null,
        h('p', { className: 'wb-studio-disclaimer' }, tr('earthLayoutNote'))))
    }

    function ProjectDeck({ items, activeId, onActive, onSelect, tr }) {
      const [hoverId, setHoverId] = useState(null)
      const activeIndex = Math.max(0, items.findIndex((project) => project.id === activeId))
      const active = items[activeIndex] || items[0]
      const plotRef = useRef(null)
      const [plotWidth, setPlotWidth] = useState(1000)

      useEffect(() => {
        const node = plotRef.current
        if (!node) return undefined
        const sync = () => setPlotWidth(Math.max(320, node.clientWidth || 1000))
        sync()
        if (typeof ResizeObserver === 'undefined') return undefined
        const observer = new ResizeObserver(sync)
        observer.observe(node)
        return () => observer.disconnect()
      }, [])

      const layout = useMemo(() => {
        const maxSize = Math.max(1, ...items.map((project) => project.sizeBytes || 0))
        const bands = [
          { id: 'persistent', label: tr('terrainBandPersistent'), y: 22, spread: 4 },
          { id: 'incubating', label: tr('terrainBandIncubating'), y: 45, spread: 14 },
          { id: 'temporary', label: tr('terrainBandTemporary'), y: 69, spread: 10 },
          { id: 'unclassified', label: tr('terrainBandUnclassified'), y: 87, spread: 5 },
        ]
        const byAge = [...items].sort((a, b) => activityMs(a.lastActivity) - activityMs(b.lastActivity))
        const rank = new Map(byAge.map((project, index) => [project.id, index]))
        const span = Math.max(1, items.length - 1)
        const nodes = items.map((project, index) => {
          const hash = [...String(project.id)].reduce((sum, char) => ((sum * 31 + char.charCodeAt(0)) >>> 0), 7)
          const band = bands.find((item) => item.id === (project.lifecycle || 'unclassified')) || bands[3]
          const jitter = (((hash % 100) / 100) - 0.5) * band.spread * 2
          return {
            project,
            x: items.length === 1 ? 50 : 6 + ((rank.get(project.id) || 0) / span) * 88,
            y: Math.max(9, Math.min(94, band.y + jitter)),
            r: 7 + Math.sqrt((project.sizeBytes || 0) / maxSize) * 18,
            band,
            index,
          }
        })
        // Names are part of the map, not a hover-only affordance. Place a
        // bounded set of high-signal labels around their dots, rejecting any
        // position that would cover another project or another label.
        const labelWidth = (project) => {
          const chars = [...String(project.displayName || project.name || '')]
          const units = chars.reduce((sum, char) => sum + (/[\u2e80-\u9fff]/.test(char) ? 11.2 : 6.2), 0)
          return Math.max(7, Math.min(28, (units / plotWidth) * 100 + 2.2))
        }
        const labelPriority = (project) =>
          (project.id === activeId ? 1000 : 0) +
          (project.pinned ? 320 : 0) +
          (project.lifecycle === 'persistent' ? 300 : 0) +
          (project.needsFollowup ? 120 : 0) +
          (project.runtime?.state === 'running' ? 100 : project.runtime?.state === 'waiting' ? 70 : 0) +
          ((project.sizeBytes || 0) / maxSize) * 35 +
          (rank.get(project.id) || 0) * 0.4
        const labelNodes = [...nodes].sort((a, b) => labelPriority(b.project) - labelPriority(a.project))
        const labelBoxes = []
        const labels = []
        for (const node of labelNodes) {
          if (labels.length >= 9) break
          const name = node.project.displayName || node.project.name || ''
          if (!name) continue
          const isFocused = node.project.id === activeId
          const w = Math.min(30, labelWidth(node.project) + (isFocused ? 1.2 : 0))
          const h = 6.2
          const rX = (node.r / 1000) * 100
          const rY = (node.r / 500) * 100
          const gap = 1.15
          const candidates = [
            { x: node.x + rX + gap, y: node.y - h / 2, align: 'left' },
            { x: node.x - rX - gap - w, y: node.y - h / 2, align: 'right' },
            { x: node.x - w / 2, y: node.y - rY - h - 1.0, align: 'center' },
            { x: node.x - w / 2, y: node.y + rY + 1.0, align: 'center' },
            { x: node.x + rX + gap, y: node.y - h - 2.0, align: 'left' },
            { x: node.x + rX + gap, y: node.y + 2.0, align: 'left' },
            { x: node.x - rX - gap - w, y: node.y - h - 2.0, align: 'right' },
            { x: node.x - rX - gap - w, y: node.y + 2.0, align: 'right' },
          ]
          let chosen = null
          for (const candidate of candidates) {
            const box = {
              x: Math.max(0.8, Math.min(99.2 - w, candidate.x)),
              y: Math.max(2.0, Math.min(95.2 - h, candidate.y)),
              w, h, align: candidate.align,
            }
            const hitsLabel = labelBoxes.some((other) =>
              box.x < other.x + other.w + 1.0 && box.x + box.w > other.x - 1.0 &&
              box.y < other.y + other.h + 0.7 && box.y + box.h > other.y - 0.7)
            if (hitsLabel) continue
            const hitsDot = nodes.some((other) =>
              other !== node && other.x > box.x - 0.8 && other.x < box.x + box.w + 0.8 &&
              other.y > box.y - 0.9 && other.y < box.y + box.h + 0.9)
            if (hitsDot) continue
            chosen = box
            break
          }
          if (!chosen) continue
          labels.push({ node, box: chosen })
          labelBoxes.push(chosen)
        }
        return { bands, nodes: nodes.slice().sort((a, b) => a.r - b.r), labels }
      }, [items, tr, activeId, plotWidth])

      if (!active) return h('div', { className: 'wb-wall-empty' }, h('b', null, tr('deckNoActive')))
      const stageList = runtimeStages(active.runtime).slice(0, 7)
      const note = active.note || active.summary || ''
      // The focused project already has a persistent name label and the
      // inspector; a hover tip on top of it only hides the label.
      const tipNode = layout.nodes.find((node) => node.project.id === hoverId && node.project.id !== activeId)
      const focusTone = projectTone(active)

      const onPlotKey = (event) => {
        if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)) return
        event.preventDefault()
        const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1
        const next = items[Math.max(0, Math.min(items.length - 1, activeIndex + step))]
        if (next) onActive(next.id)
      }

      return h('div', { className: 'wb-terrain' },
        h('div', { className: 'wb-terrain-head' },
          h('div', { className: 'wb-terrain-kicker' }, h('i', { className: 'wb-wall-live-dot' }), tr('terrainKicker')),
          h('span', { className: 'wb-terrain-count' }, tr('terrainCount', { n: items.length })),
          h('div', { className: 'wb-terrain-legend' },
            ['persistent', 'incubating', 'temporary', 'unclassified'].map((id) => h('span', { key: id, className: `is-${id}` },
              h('i', null), lifecycleLabel(id, tr))))),
        h('div', { className: 'wb-terrain-shell' },
          h('div', {
            className: 'wb-terrain-plot', ref: plotRef, tabIndex: 0, role: 'application',
            'aria-label': tr('terrainKicker'), onKeyDown: onPlotKey,
          },
            h('div', { className: 'wb-terrain-bands', 'aria-hidden': true },
              layout.bands.map((band) => h('div', { key: band.id, className: `wb-terrain-band is-${band.id}`, style: { top: `${band.y}%` } },
                h('span', null, band.label)))),
            h('div', { className: 'wb-terrain-field' },
              h('div', { className: 'wb-terrain-grid', 'aria-hidden': true },
                [0, 25, 50, 75, 100].map((x) => h('i', { key: x, style: { left: `${x}%` } }))),
              layout.nodes.map((node) => {
                const isActive = node.project.id === active.id
                const isHover = node.project.id === hoverId
                const tone = projectTone(node.project)
                return h('button', {
                  key: node.project.id,
                  type: 'button',
                  className: cx('wb-terrain-node', `is-life-${node.project.lifecycle || 'unclassified'}`, isActive && 'is-focused', isHover && 'is-hover', `is-status-${tone}`),
                  'data-project-id': node.project.id,
                  style: {
                    left: `${node.x}%`, top: `${node.y}%`, '--r': `${node.r}px`,
                    '--wb-accent': projectAccent(node.project), '--i': node.index,
                  },
                  title: `${node.project.displayName || node.project.name} · ${lifecycleLabel(node.project.lifecycle, tr)} · ${relTime(node.project.lastActivity, tr)}`,
                  'aria-label': `${node.project.displayName || node.project.name} · ${lifecycleLabel(node.project.lifecycle, tr)}`,
                  'aria-pressed': isActive,
                  onClick: () => onActive(node.project.id),
                  onDoubleClick: () => onSelect(node.project),
                  onMouseEnter: () => setHoverId(node.project.id),
                  onMouseLeave: () => setHoverId(null),
                  onFocus: () => { setHoverId(node.project.id); onActive(node.project.id) },
                  onBlur: () => setHoverId(null),
                },
                  h('span', { className: 'wb-terrain-dot' }, tone === 'running' ? h('i', null) : null),
                  node.project.needsFollowup ? h('span', { className: 'wb-terrain-flag' }, h(Glyph, { name: 'flag', size: 9 })) : null)
              }),
              h('div', { className: 'wb-terrain-labels', 'aria-hidden': true },
                layout.labels.map(({ node, box }) => h('span', {
                  key: node.project.id,
                  className: cx('wb-terrain-label', box.align === 'right' && 'is-right', node.project.id === active.id && 'is-focused'),
                  style: { left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%` },
                },
                  h('b', null, node.project.displayName || node.project.name),
                  h('small', null, relTime(node.project.lastActivity, tr))))),
              tipNode ? h('div', {
                className: cx('wb-terrain-tip', tipNode.y < 20 && 'is-below', tipNode.x > 78 && 'is-tip-left', tipNode.x < 20 && 'is-tip-right'),
                style: { left: `${tipNode.x}%`, top: `${tipNode.y}%` },
              },
                h('b', null, tipNode.project.displayName || tipNode.project.name),
                h('span', null, `${lifecycleLabel(tipNode.project.lifecycle, tr)} · ${relTime(tipNode.project.lastActivity, tr)}`),
                h('small', null, `${fmtBytes(tipNode.project.sizeBytes || 0)} · ${tr('sessionCountLabel', { n: tipNode.project.sessionCount || 0 })}`)) : null),
            h('div', { className: 'wb-terrain-axis', 'aria-hidden': true },
              h('span', null, tr('terrainOld')),
              h('span', { className: 'wb-terrain-axis-line' }, h('i', null), tr('terrainRecent'), h('i', null)),
              h('span', null, tr('terrainNow')))),
          h('aside', { className: cx('wb-terrain-inspector', `is-${focusTone}`), key: active.id, 'data-project-id': active.id },
            h('div', { className: 'wb-terrain-inspector-top' },
              h(StatusPill, { status: active.status || 'unknown', tr }),
              h('span', { className: cx('wb-life-chip', `is-${active.lifecycle || 'unclassified'}`) }, lifecycleLabel(active.lifecycle, tr))),
            h('h2', { className: 'wb-terrain-name', 'data-wb-morph-title': '1', 'aria-live': 'polite' }, active.displayName || active.name),
            h('div', { className: 'wb-terrain-path', title: active.path }, active.path),
            note ? h('p', { className: 'wb-terrain-note' }, truncate(note, 150)) : h('p', { className: 'wb-terrain-note is-empty' }, tr('wallNoArtifact')),
            h('div', { className: 'wb-terrain-metrics' },
              h('div', null, h('b', null, relTime(active.lastActivity, tr)), h('span', null, tr('terrainRecent'))),
              h('div', null, h('b', null, fmtBytes(active.sizeBytes || 0)), h('span', null, tr('terrainSize'))),
              h('div', null, h('b', null, String(active.sessionCount || 0)), h('span', null, tr('sessions'))),
              h('div', null, h('b', null, String(active.folderCount || 1)), h('span', null, tr('projectFolders')))),
            stageList.length ? h('div', { className: 'wb-terrain-stages', 'aria-label': tr('runtimePipeline') },
              stageList.map((stage, index) => h('span', { key: stage.id || stage.label || index, className: cx('wb-terrain-stage', `is-${stage.state || 'pending'}`), title: stage.label || '' }, h('i'))) ) : null,
            h('div', { className: 'wb-terrain-actions' },
              h('button', { className: 'wb-btn primary', type: 'button', onClick: () => onSelect(active) }, h(Glyph, { name: 'arrow', size: 14 }), tr('terrainEnter')),
              h('span', null, tr('terrainHint'))),
            h('div', { className: 'wb-terrain-coord' },
              h('span', null, `${String(activeIndex + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`),
              h('span', { className: cx('wb-terrain-state', `is-${focusTone}`) }, h('i', null), active.runtime?.state ? tr(RUNTIME_STATE_KEYS[active.runtime.state] || 'runtimeUnknown') : statusLabel(active.status, tr))))))
    }

    function ProjectBoard({ projects, tr, onSelect, onFollowup, onShowAll }) {
      const live = projects.filter((p) => p.status !== 'archived')
      const rank = (p) => p.pinned ? -1 : p.runtime?.state === 'running' ? 0 : p.runtime?.state === 'waiting' ? 1 : p.runtime?.state === 'blocked' || p.runtime?.state === 'failed' ? 2 : p.needsFollowup ? 3 : 4
      const byActivity = (a, b) => activityMs(b.lastActivity) - activityMs(a.lastActivity)
      const ordered = [...live].sort((a, b) => rank(a) - rank(b) || byActivity(a, b))
      const projectWork = ordered.filter((p) => p.lifecycle === 'persistent' || p.lifecycle === 'incubating')
      const persistentWork = projectWork.filter((p) => p.lifecycle === 'persistent')
      const incubatingWork = projectWork.filter((p) => p.lifecycle === 'incubating')
      const temporary = ordered.filter((p) => p.lifecycle === 'temporary')
      const inbox = ordered.filter((p) => p.lifecycle === 'unclassified')
      const [scope, setScope] = useState('projects')
      const [activeId, setActiveId] = useState(null)
      const collection = scope === 'temporary' ? temporary : scope === 'unclassified' ? inbox : scope === 'all' ? ordered : projectWork
      const activeIdSafe = collection.some((p) => p.id === activeId) ? activeId : (collection[0]?.id || null)
      useEffect(() => {
        if (activeId !== activeIdSafe) setActiveId(activeIdSafe)
      }, [activeId, activeIdSafe])
      const total = ordered.length
      const active = ordered.filter((p) => p.status === 'active').length
      const pending = ordered.filter((p) => p.needsFollowup).length
      const dateLabel = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date())
      const scopes = [
        { id: 'projects', label: tr('wallLifecycleProjects'), count: projectWork.length },
        { id: 'temporary', label: tr('wallLifecycleTemporary'), count: temporary.length },
        { id: 'unclassified', label: tr('wallLifecycleUnclassified'), count: inbox.length },
        { id: 'all', label: tr('wallLifecycleAll'), count: ordered.length },
      ]
      const queueGroups = scope === 'projects'
        ? [
            { id: 'persistent', label: tr('wallBandPersistent'), items: persistentWork },
            { id: 'incubating', label: tr('wallBandIncubating'), items: incubatingWork },
          ]
        : [{ id: scope, label: scopes.find((item) => item.id === scope)?.label || tr('projects'), items: collection }]
      const ribbonItems = [...(scope === 'projects' ? projectWork : collection)]
        .sort((a, b) => activityMs(a.lastActivity) - activityMs(b.lastActivity))
      const emptyText = scope === 'temporary' ? tr('wallTemporaryEmpty')
        : scope === 'unclassified' ? tr('wallUnclassifiedSub')
        : tr('wallNoPersistent')
      const emptyHint = scope === 'temporary' ? tr('wallTemporarySub')
        : scope === 'unclassified' ? tr('wallUnclassifiedHint')
        : tr('wallNoPersistentSub')
      const shelfTime = (p) => {
        if (!p.expiresAt) return ''
        const expired = (Date.parse(p.expiresAt) || 0) <= Date.now()
        return expired ? tr('wallTemporaryExpired') : tr('wallTemporaryExpires', { t: fmtDate(p.expiresAt) })
      }
      return h('div', { className: 'wb-wall-page' },
        h('section', { className: 'wb-wall-hero' },
          h('div', { className: 'wb-wall-kicker' }, h('i', { className: 'wb-wall-live-dot' }), tr('wallKicker'), h('span', null, dateLabel)),
          h('div', { className: 'wb-wall-headline' },
            h('h1', { className: 'wb-wall-title' }, tr('wallTitleA'), h('em', null, tr('wallTitleB'))),
            h('p', { className: 'wb-wall-sub' }, tr('wallSub', { total, active, pending }))),
          h('div', { className: 'wb-wall-actions' },
            h('button', { type: 'button', className: 'wb-btn primary', onClick: onShowAll },
              h(Glyph, { name: 'layers', size: 14 }), tr('wallAll', { n: total })),
            h('button', { type: 'button', className: 'wb-btn ghost', onClick: onFollowup, disabled: !pending },
              h(Glyph, { name: 'flag', size: 14 }), tr('boardAttnPending'), pending ? h('b', null, String(pending)) : null)),
          h('div', { className: 'wb-wall-facts' },
            h('div', null, h('b', null, h(CountUp, { value: total })), h('span', null, tr('projects'))),
            h('div', null, h('b', null, h(CountUp, { value: persistentWork.length })), h('span', null, tr('lifecyclePersistent'))),
            h('div', null, h('b', null, h(CountUp, { value: pending })), h('span', null, tr('boardAttnPending'))),
            h('div', null, h('b', null, h(CountUp, { value: temporary.length })), h('span', null, tr('wallLifecycleTemporary'))))),
        h('div', { className: 'wb-lifecycle-switch', role: 'tablist', 'aria-label': tr('wallLifecycleSummary', {
          p: projectWork.length, i: projectWork.filter((p) => p.lifecycle === 'incubating').length, t: temporary.length, u: inbox.length,
        }) },
          scopes.map((item) => h('button', {
            key: item.id, type: 'button', role: 'tab', 'aria-selected': scope === item.id,
            className: cx('wb-lifecycle-tab', scope === item.id && 'is-active'), onClick: () => setScope(item.id),
          }, h('span', null, item.label), h('b', null, String(item.count)))),
          h('span', { className: 'wb-lifecycle-rule' }, tr('wallLifecycleSummary', {
            p: projectWork.filter((p) => p.lifecycle === 'persistent').length,
            i: projectWork.filter((p) => p.lifecycle === 'incubating').length,
            t: temporary.length,
            u: inbox.length,
          }))),
        collection.length
          ? h(React.Fragment, null,
            h(ProjectDeck, {
              key: scope,
              items: collection,
              groups: queueGroups,
              ribbonItems,
              activeId: activeIdSafe,
              onActive: setActiveId,
              onSelect,
              tr,
            }))
          : h('div', { className: 'wb-wall-empty' }, h(Glyph, { name: scope === 'temporary' ? 'clock' : 'grid', size: 24 }), h('b', null, emptyText), h('span', null, emptyHint),
            scope === 'projects' && inbox.length ? h('button', { className: 'wb-btn ghost', onClick: () => setScope('unclassified') }, tr('wallUnclassifiedTitle'), h('b', null, String(inbox.length))) : null),
        scope === 'projects' && temporary.length ? h('section', { className: 'wb-life-shelf is-temporary' },
          h('div', { className: 'wb-life-shelf-head' },
            h('div', null, h('h2', null, h(Glyph, { name: 'clock', size: 14 }), tr('wallTemporaryTitle')), h('p', null, tr('wallTemporarySub'))),
            h('button', { className: 'wb-link', onClick: () => setScope('temporary') }, tr('wallLifecycleAll'), h('b', null, String(temporary.length)), h(Glyph, { name: 'arrow', size: 12 }))),
          h('div', { className: 'wb-life-shelf-list' }, temporary.slice(0, 5).map((p) => h('button', {
            key: p.id, type: 'button', className: 'wb-life-shelf-row', 'data-project-id': p.id, onClick: () => onSelect(p),
          },
            h('span', { className: 'wb-life-shelf-mark' }, h(Glyph, { name: 'clock', size: 12 })),
            h('span', { className: 'wb-life-shelf-main' }, h('b', { 'data-wb-morph-title': '1' }, p.displayName || p.name), h('small', null, p.note || p.summary || p.path)),
            h('span', { className: cx('wb-life-shelf-time', p.cleanup?.reason && 'is-due') }, shelfTime(p)),
            h(Glyph, { name: 'arrow', size: 12 }))))) : null,
        scope === 'projects' && inbox.length ? h('section', { className: 'wb-life-shelf is-inbox' },
          h('div', { className: 'wb-life-shelf-head' },
            h('div', null, h('h2', null, h(Glyph, { name: 'tag', size: 14 }), tr('wallUnclassifiedTitle')), h('p', null, tr('wallUnclassifiedSub'))),
            h('button', { className: 'wb-link', onClick: () => setScope('unclassified') }, tr('wallLifecycleAll'), h('b', null, String(inbox.length)), h(Glyph, { name: 'arrow', size: 12 }))),
          h('div', { className: 'wb-life-shelf-list' }, inbox.slice(0, 5).map((p) => h('button', {
            key: p.id, type: 'button', className: 'wb-life-shelf-row', 'data-project-id': p.id, onClick: () => onSelect(p),
          },
            h('span', { className: 'wb-life-shelf-mark' }, h(Glyph, { name: 'tag', size: 12 })),
            h('span', { className: 'wb-life-shelf-main' }, h('b', { 'data-wb-morph-title': '1' }, p.displayName || p.name), h('small', null, p.note || p.summary || p.path)),
            h('span', { className: 'wb-life-shelf-time' }, tr('wallUnclassifiedHint')),
            h(Glyph, { name: 'arrow', size: 12 }))))) : null,
        live.length > 19 && scope === 'projects' ? h('button', { className: 'wb-wall-all', onClick: onShowAll },
          h('span', null, tr('wallViewAll', { n: live.length })), h(Glyph, { name: 'arrow', size: 15 })) : null)
    }

    function ProjectTable({ projects, tr, onSelect, selectionMode, selectedIds, onToggle }) {
      return h('div', { className: 'wb-table-wrap' },
        h('table', { className: 'wb-table' },
          h('thead', null, h('tr', null,
            selectionMode ? h('th', { className: 'sel' }, '') : null,
            h('th', null, tr('projects')),
            h('th', null, tr('status')),
            h('th', null, tr('sourcesLabel')),
            h('th', null, tr('lastActivity')),
            h('th', { className: 'num' }, tr('size')),
            h('th', null, tr('path')))),
          h('tbody', null, projects.map((p) => {
            const selectable = Boolean(p.topLevel && p.status === 'archived' && p.deletable !== false)
            const notSelectable = selectionMode && !selectable
            const selected = selectedIds.has(p.id)
            const choose = () => {
              if (selectionMode && selectable) onToggle(p)
              else if (!selectionMode) onSelect(p)
            }
            return h('tr', {
              key: p.id,
              'data-project-id': p.id,
              className: cx(selected && 'selected', notSelectable && 'not-selectable'),
              tabIndex: notSelectable ? -1 : 0,
              'aria-disabled': notSelectable || undefined,
              title: notSelectable ? (p.deleteBlocked || tr('selectArchivedOnly')) : undefined,
              role: 'button',
              onClick: choose,
              onDoubleClick: selectionMode ? undefined : choose,
              onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose() } },
            },
              selectionMode ? h('td', { className: 'sel' },
                h('input', {
                  type: 'checkbox',
                  className: 'wb-select-check',
                  checked: selected,
                  disabled: !selectable,
                  title: tr('selectArchivedOnly'),
                  onClick: (e) => e.stopPropagation(),
                  onKeyDown: (e) => e.stopPropagation(),
                  onChange: () => onToggle(p),
                  'aria-label': `${tr('selectArchivedOnly')}: ${p.displayName || p.name}`,
                })) : null,
              h('td', { className: 'name' }, h('span', { 'data-wb-morph-title': '1' }, p.pinned ? '★ ' : '', p.displayName || p.name),
                p.needsFollowup ? h('span', { className: 'wb-chip accent', style: { marginLeft: '6px' } }, tr('followupNew')) : null),
              h('td', { 'data-label': tr('status') }, h(StatusPill, { status: p.status, tr })),
              h('td', { 'data-label': tr('sourcesLabel') }, (p.sources || []).map((s) => h('span', { className: 'wb-chip', key: s, style: { marginRight: '3px' } }, sourceLabel(s, tr)))),
              h('td', { className: 'num', 'data-label': tr('lastActivity') }, relTime(p.lastActivity, tr)),
              h('td', { className: 'num', 'data-label': tr('size') }, fmtBytes(p.sizeBytes)),
              h('td', { className: 'path', 'data-label': tr('path') }, p.path))
          }))))
    }

    function DeleteDialog({ items, tr, onClose, onConfirm, busy, error }) {
      const [mode, setMode] = useState('recycle')
      const [checked, setChecked] = useState({})
      const [ack, setAck] = useState(false)
      const modalRef = useRef(null)

      useEffect(() => {
        setMode('recycle')
        setChecked({})
        setAck(false)
      }, [items.map((p) => p.id).join('|')])

      useEffect(() => {
        const previous = document.activeElement
        modalRef.current?.querySelector('button, input')?.focus()
        return () => { if (previous && typeof previous.focus === 'function') previous.focus() }
      }, [])

      useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose() }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
      }, [busy, onClose])

      const allChecked = items.length > 0 && items.every((p) => checked[p.id])
      const canConfirm = allChecked && !busy && (mode === 'recycle' || ack)
      const total = items.reduce((sum, p) => sum + (p.sizeBytes || 0), 0)
      const toggle = (id) => setChecked((prev) => ({ ...prev, [id]: !prev[id] }))
      const checkAll = () => {
        const next = {}
        for (const p of items) next[p.id] = true
        setChecked(next)
      }
      const confirm = () => {
        if (!canConfirm) return
        onConfirm(mode)
      }

      return h('div', {
        className: 'wb-modal-backdrop',
        onMouseDown: (e) => { if (e.target === e.currentTarget && !busy) onClose() },
      },
        h('div', {
          className: 'wb-modal',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-labelledby': 'wb-delete-title',
          'aria-describedby': 'wb-delete-desc',
          ref: modalRef,
          onKeyDown: (e) => {
            if (e.key !== 'Tab' || !modalRef.current) return
            const focusable = [...modalRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled])')]
            if (!focusable.length) return
            const first = focusable[0]
            const last = focusable[focusable.length - 1]
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
          },
        },
          h('div', { className: 'wb-modal-head' },
            h('div', { style: { flex: 1, minWidth: 0 } },
              h('div', { className: 'wb-modal-title', id: 'wb-delete-title' }, tr('deleteTitle')),
              h('div', { className: 'wb-modal-sub', id: 'wb-delete-desc' }, tr('deleteSubtitle'))),
            h('button', { className: 'wb-btn ghost icon', onClick: onClose, disabled: busy, 'aria-label': tr('close') }, h(Glyph, { name: 'close', size: 16 }))),
          h('div', { className: 'wb-modal-body' },
            h('div', { className: 'wb-mode-grid' },
              h('label', { className: cx('wb-mode-option', mode === 'recycle' && 'on') },
                h('input', { type: 'radio', name: 'wb-delete-mode', checked: mode === 'recycle', onChange: () => setMode('recycle') }),
                h('span', null, h('strong', null, tr('deleteRecycle')), tr('deleteRecycleHint'))),
              h('label', { className: cx('wb-mode-option', mode === 'permanent' && 'on') },
                h('input', { type: 'radio', name: 'wb-delete-mode', checked: mode === 'permanent', onChange: () => setMode('permanent') }),
                h('span', null, h('strong', null, tr('deletePermanent')), tr('deletePermanentHint')))),
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
              h('span', { className: 'wb-batchbar-meta' }, tr('selectedSummary', { n: items.length, size: fmtBytes(total) })),
              h('span', { style: { flex: 1 } }),
              h('button', { className: 'wb-btn ghost', onClick: checkAll, disabled: busy || allChecked }, h(Glyph, { name: 'check', size: 13 }), allChecked ? tr('deleteCheckedAll') : tr('deleteCheckAll'))),
            h('div', { className: 'wb-delete-list', role: 'group', 'aria-label': tr('deleteTitle') },
              items.map((p) => h('label', { className: 'wb-delete-row', key: p.id },
                h('input', {
                  type: 'checkbox',
                  checked: Boolean(checked[p.id]),
                  onChange: () => toggle(p.id),
                  disabled: busy,
                  'aria-label': `${tr('deleteItemConfirm')} ${p.displayName || p.name}`,
                }),
                h('span', { style: { minWidth: 0 } },
                  h('div', { className: 'wb-delete-name', title: p.displayName || p.name }, p.displayName || p.name),
                  h('div', { className: 'wb-delete-path' }, p.path)),
                h('span', { className: 'wb-delete-size' }, fmtBytes(p.sizeBytes))))),
            h('div', { className: 'wb-delete-warning' },
              h(Glyph, { name: 'alert', size: 15 }),
              h('span', null, mode === 'permanent' ? tr('deletePermanentHint') : tr('deleteRecycleHint'))),
            mode === 'permanent' ? h('label', { className: 'wb-delete-ack' },
              h('input', { type: 'checkbox', checked: ack, onChange: (e) => setAck(e.target.checked), disabled: busy }),
              h('span', null, tr('deletePermanentAck'))) : null,
            error ? h('div', { className: 'wb-modal-error', role: 'alert' }, error) : null,
            h('div', { className: 'wb-modal-hint' }, tr('deleteSafeHint'), ' ', tr('deleteAuditHint'))),
          h('div', { className: 'wb-modal-foot' },
            h('button', { className: 'wb-btn ghost', onClick: onClose, disabled: busy }, tr('cancel')),
            h('span', { className: 'grow' }),
            h('button', {
              className: 'wb-btn danger',
              onClick: confirm,
              disabled: !canConfirm,
            }, h(Glyph, { name: 'trash', size: 14 }),
            busy ? tr('deleteBusy') : mode === 'permanent'
              ? tr('deleteConfirmPermanent', { n: items.length })
              : tr('deleteConfirmRecycle', { n: items.length })))))
    }

    function SoftwareView({ software, tr, onOpen }) {
      const [cat, setCat] = useState('all')
      const [q, setQ] = useState('')
      const cats = useMemo(() => [...new Set(software.map((s) => s.category))], [software])
      const list = useMemo(() => software.filter((s) => {
        if (cat !== 'all' && s.category !== cat) return false
        if (q && !`${s.name} ${s.publisher || ''} ${s.installPath || ''}`.toLowerCase().includes(q.toLowerCase())) return false
        return true
      }), [software, cat, q])
      return h('div', null,
        h('div', { className: 'wb-tools' },
          h('div', { className: 'wb-search' }, h('span', { className: 'wb-search-icon' }, h(Glyph, { name: 'search', size: 15 })), h('input', { className: 'wb-input', placeholder: tr('searchSoftware'), value: q, onChange: (e) => setQ(e.target.value) })),
          h('select', { className: 'wb-select', value: cat, onChange: (e) => setCat(e.target.value) },
            h('option', { value: 'all' }, tr('categoryAll')),
            cats.map((c) => h('option', { value: c, key: c }, tr(c) || c))),
          h('div', { style: { flex: 1 } }),
          h('span', { className: 'wb-panel-sub' }, `${list.length} ${tr('softwareCountLabel')}`)),
        list.length ? h('div', { className: 'wb-sw-grid' }, list.map((s) => {
          const color = s.category === 'coding' ? 'var(--dsw-alias-brand-primary)' : s.category === 'agent' ? 'var(--dsw-alias-state-success-primary)' : s.category === 'image' || s.category === 'video' ? 'var(--dsw-alias-state-warn-primary)' : 'var(--dsw-alias-link)'
          return h('div', { className: 'wb-sw-card', key: s.name + (s.installPath || '') },
            h('div', { className: 'wb-sw-top' },
              h('div', { className: 'wb-sw-avatar', style: { '--sw-color': color } }, (s.name || '?').slice(0, 1)),
              h('div', { style: { minWidth: 0 } },
                h('div', { className: 'wb-sw-name', title: s.name }, s.name),
                h('div', { className: 'wb-sw-cat' }, tr(s.categoryLabel || s.category) || s.categoryLabel || s.category)),
              h('div', { className: 'wb-sw-ver' }, s.version || tr('unknownVersion'))),
            h('div', { className: 'wb-sw-path', title: s.installPath || s.configPath || '' }, s.installPath || s.configPath || '—'),
            h('div', { className: 'wb-sw-foot' },
              h('span', { className: 'wb-dot', style: { background: s.status === 'recent' ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-label-tertiary)' } }),
              h('span', null, s.status === 'recent' ? tr('recent') : tr('installed')),
              s.lastConfigWrite ? h('span', { style: { marginLeft: 'auto' } }, relTime(s.lastConfigWrite, tr)) : null,
              s.installPath ? h('button', { className: 'wb-btn ghost', style: { padding: '2px 5px', marginLeft: '4px' }, onClick: (e) => { e.stopPropagation(); onOpen(s.installPath) }, title: tr('openFolder') }, h(Glyph, { name: 'folder', size: 13 })) : null))
        })) : h('div', { className: 'wb-empty' },
          h('div', { className: 'wb-empty-icon' }, h(Glyph, { name: 'software', size: 19 })),
          h('div', { className: 'wb-empty-title' }, tr('noSoftware'))))
    }

    function DiskView({ data, tr, onOpen, onCleanup }) {
      const projects = data.projects.filter((p) => p.topLevel && !p.hidden && !p.noise)
      const top = [...projects].sort((a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0)).slice(0, 12)
      const max = Math.max(1, ...top.map((p) => p.sizeBytes || 0))
      const byWorkspace = useMemo(() => {
        const m = new Map()
        for (const p of projects) {
          const k = p.workspace || tr('ungrouped')
          const cur = m.get(k) || { name: k, bytes: 0, count: 0 }
          cur.bytes += p.sizeBytes || 0; cur.count++
          m.set(k, cur)
        }
        return [...m.values()].sort((a, b) => b.bytes - a.bytes).slice(0, 8)
      }, [projects, tr])
      const cleanup = projects.filter((p) => p.status === 'archived' && p.deletable !== false).sort((a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0)).slice(0, 8)
      return h('div', null,
        h('div', { className: 'wb-disk-grid' }, (data.disks || []).filter((d) => d.total > 0).map((d) => {
          const used = d.used || (d.total - d.free)
          const pct = Math.max(0, Math.min(100, (used / d.total) * 100))
          return h('div', { className: 'wb-disk-card', key: d.name },
            h('div', { className: 'wb-disk-top' },
              h('div', { className: 'wb-disk-letter' }, d.name),
              h('div', { className: 'wb-disk-free' }, `${tr('free')} ${fmtGiB(d.free)}`)),
            h('div', { className: 'wb-disk-cap' }, `${fmtGiB(used)} / ${fmtGiB(d.total)} · ${pct.toFixed(1)}%`),
            h('div', { className: 'wb-disk-track' }, h('div', { className: cx('wb-disk-fill', pct > 85 && 'warn'), style: { '--wb-pct': pct / 100 } })))
        })),
        h('div', { className: 'wb-dash', style: { gridTemplateColumns: 'minmax(0,1.35fr) minmax(280px,1fr)' } },
          h('div', { className: 'wb-dash-col' },
            h(Panel, { title: tr('topProjects'), sub: tr('diskNote') },
              h('div', { className: 'wb-bars' }, top.map((p) => h('div', { className: 'wb-bar-row', key: p.id, style: { cursor: 'pointer' }, onClick: () => onOpen(p) },
                h('div', { className: 'wb-bar-label', title: p.path }, p.displayName || p.name),
                h('div', { className: 'wb-bar-val' }, fmtBytes(p.sizeBytes)),
                h('div', { className: 'wb-bar-track' }, h('div', { className: 'wb-bar-fill', style: { '--wb-pct': Math.max(0.02, (p.sizeBytes || 0) / max) } })))))),
            h(Panel, { title: tr('cleanupCandidates'), sub: tr('cleanupHint'), action: h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
              h('span', { className: 'wb-chip' }, tr('notDeleted')),
              h('button', { className: 'wb-btn ghost', onClick: onCleanup }, tr('goCleanup'), h(Glyph, { name: 'arrow', size: 12 }))) },
              cleanup.length ? h('div', { className: 'wb-list' }, cleanup.map((p, i) => h(RowProject, { key: p.id, p, index: i, tr, onSelect: onOpen }))) : h('div', { className: 'wb-empty' }, tr('empty')))),
          h('div', { className: 'wb-dash-col' },
            h(Panel, { title: tr('workspaceUsage'), sub: tr('workspaceCount') },
              h('div', { className: 'wb-bars' }, byWorkspace.map((w) => h('div', { className: 'wb-bar-row', key: w.name },
                h('div', { className: 'wb-bar-label' }, w.name, h('span', { style: { color: 'var(--dsw-alias-label-dimmed)', marginLeft: '5px' } }, `(${w.count})`)),
                h('div', { className: 'wb-bar-val' }, fmtBytes(w.bytes)),
                h('div', { className: 'wb-bar-track' }, h('div', { className: 'wb-bar-fill', style: { '--wb-pct': Math.max(0.02, w.bytes / Math.max(1, byWorkspace[0]?.bytes || 1)) } })))))),
            h(Panel, { title: tr('archiveNote'), sub: tr('diskNote') },
              h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-tertiary)', lineHeight: 1.65 } }, tr('cleanupHint'))))))
    }

    function HandoffDialog({ source, tr, onClose, onStart, onRecord, onPersist, notify }) {
      const initial = useMemo(() => buildHandoffValues(source, tr), [source, tr])
      const [goal, setGoal] = useState(initial.goal)
      const [progress, setProgress] = useState(initial.progress)
      const [constraints, setConstraints] = useState(initial.constraints)
      const [files, setFiles] = useState(initial.files)
      const [busy, setBusy] = useState(false)
      const [targetApp, setTargetApp] = useState('dsh')
      const [targetSessionKey, setTargetSessionKey] = useState('')
      const [persistProject, setPersistProject] = useState(false)
      const [persistAgents, setPersistAgents] = useState(false)
      const [error, setError] = useState('')
      const [replaceNeeded, setReplaceNeeded] = useState(false)
      const linkedSessions = useMemo(() => (source?.project?.sessions || [])
        .filter((session) => session?.id && session.available !== false)
        .sort((a, b) => (Date.parse(b.updatedAt || '') || 0) - (Date.parse(a.updatedAt || '') || 0))
        .slice(0, 6), [source])
      const selectedSession = linkedSessions.find((session) => `session:${session.source || 'dsh'}:${session.id}` === targetSessionKey) || null
      const previewRef = useRef(null)
      const dialogRef = useRef(null)

      useEffect(() => {
        const previous = document.activeElement
        const node = dialogRef.current
        if (node && !node.contains(document.activeElement)) node.querySelector('textarea, button')?.focus()
        return () => { if (previous && typeof previous.focus === 'function') previous.focus() }
      }, [])

      useEffect(() => {
        setGoal(initial.goal)
        setProgress(initial.progress)
        setConstraints(initial.constraints)
        setFiles(initial.files)
        setTargetApp('dsh')
        setTargetSessionKey('')
        setPersistProject(false)
        setPersistAgents(false)
        setError('')
        setReplaceNeeded(false)
      }, [source])

      const prompt = useMemo(() => buildHandoffPrompt({
        ...initial,
        goal,
        progress,
        constraints,
        files,
      }, tr), [initial, goal, progress, constraints, files, tr])

      const copy = async () => {
        const copied = await copyText(prompt)
        if (!copied) {
          previewRef.current?.focus()
          previewRef.current?.select()
          setError(tr('handoffCopyFailed'))
          return
        }
        notify(tr('handoffCopied'))
        let persisted = null
        if (persistProject) {
          try {
            persisted = await onPersist?.(prompt, source, { ...initial, goal, progress, constraints, files, targetApp, targetSessionId: selectedSession?.id || '', persistProject, persistAgents })
            if (persisted?.ok === false) throw new Error(persisted.error || tr('handoffPersistFailed'))
          } catch (persistError) {
            setError(`${tr('handoffPersistFailed')}：${persistError?.message || persistError}`.trim())
          }
        }
        try {
          await onRecord?.(prompt, source, { ...initial, goal, progress, constraints, files, targetApp, targetSessionId: selectedSession?.id || '', persistProject, persistAgents, projectDoc: persisted?.docPath || '' })
        } catch { /* best-effort local record */ }
      }

      const submit = async (force = false) => {
        if (!goal.trim()) {
          setError(tr('handoffGoalRequired'))
          return
        }
        setBusy(true)
        setError('')
        try {
          const result = await onStart(prompt, source, { force, targetApp, targetSession: selectedSession }, { ...initial, goal, progress, constraints, files, targetApp, targetSessionId: selectedSession?.id || '', persistProject, persistAgents })
          if (result?.needsConfirm) {
            setReplaceNeeded(true)
            return
          }
          if (result?.ok === false) throw new Error(result.error || tr('handoffUnavailable'))
          onClose()
        } catch (submitError) {
          setError(submitError?.message || String(submitError))
        } finally {
          setBusy(false)
        }
      }

      const field = (label, value, setValue, placeholder, required = false) => h('div', { className: 'wb-handoff-field' },
        h('div', { className: 'wb-handoff-label' }, label, required ? h('span', { className: 'wb-handoff-required' }, ' *') : null),
        h('textarea', {
          className: 'wb-textarea',
          value,
          placeholder,
          disabled: busy,
          autoFocus: required,
          onChange: (event) => setValue(event.target.value),
        }))

      return h('div', {
        className: 'wb-modal-backdrop',
        onClick: (event) => { if (event.target === event.currentTarget && !busy) onClose() },
        onKeyDown: (event) => {
          if (event.key === 'Escape' && !busy) {
            event.preventDefault()
            event.stopPropagation()
            onClose()
          }
        },
        onKeyUp: (event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
          }
        },
      },
        h('div', {
          className: 'wb-modal wb-handoff-modal',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': tr('handoffTitle'),
          ref: dialogRef,
          tabIndex: -1,
          onKeyDown: (event) => {
            if (event.key !== 'Tab' || !dialogRef.current) return
            const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled])')]
            if (!focusable.length) return
            const first = focusable[0]
            const last = focusable[focusable.length - 1]
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
          },
        },
          h('div', { className: 'wb-modal-head' },
            h('div', { style: { flex: 1, minWidth: 0 } },
              h('div', { className: 'wb-modal-title' }, source?.mode === 'new' ? tr('wsStartTitle') : tr('handoffTitle')),
              h('div', { className: 'wb-modal-sub' }, selectedSession ? tr('handoffExistingHint') : source?.mode === 'new' ? tr('wsStartSub') : tr('handoffSub'))),
            h('button', {
              className: 'wb-btn ghost icon',
              onClick: onClose,
              disabled: busy,
              'aria-label': tr('close'),
            }, h(Glyph, { name: 'close', size: 16 }))),
          h('div', { className: 'wb-modal-body wb-handoff-body' },
            h('div', { className: 'wb-handoff-source' },
              h(Glyph, { name: 'agent', size: 16 }),
              h('div', { style: { minWidth: 0 } },
                h('div', { className: 'wb-handoff-source-title' }, initial.sourceLabel),
                h('div', { className: 'wb-handoff-source-path' }, initial.projectPath || tr('handoffNoPath')))),
            initial.notice ? h('div', { className: 'wb-handoff-note' }, h(Glyph, { name: 'alert', size: 14 }), h('span', null, initial.notice)) : null,
            field(tr('handoffGoal'), goal, setGoal, tr('handoffGoalPlaceholder'), true),
            field(tr('handoffProgress'), progress, setProgress, tr('handoffProgressPlaceholder')),
            field(tr('handoffConstraints'), constraints, setConstraints, tr('handoffConstraintsPlaceholder')),
            field(tr('handoffFiles'), files, setFiles, tr('handoffFilesPlaceholder')),
            h('div', { className: 'wb-handoff-field' },
              h('div', { className: 'wb-handoff-label' }, tr('inheritTarget')),
              h('select', {
                className: 'wb-select',
                value: targetSessionKey || targetApp,
                disabled: busy,
                onChange: (event) => {
                  const value = event.target.value
                  if (value.startsWith('session:')) {
                    const session = linkedSessions.find((item) => `session:${item.source || 'dsh'}:${item.id}` === value) || null
                    setTargetSessionKey(session ? value : '')
                    setTargetApp(session?.source || 'dsh')
                  } else {
                    setTargetSessionKey('')
                    setTargetApp(value)
                  }
                },
                style: { width: '100%' },
              },
                h('option', { value: 'dsh' }, tr('inheritDsh')),
                h('option', { value: 'opencode' }, tr('inheritOpenCode')),
                h('option', { value: 'codex' }, tr('inheritCodex')),
                h('option', { value: 'comfyui' }, tr('inheritComfy')),
                h('option', { value: 'other' }, tr('inheritOther')),
                linkedSessions.length ? h('optgroup', { label: tr('inheritExistingGroup') },
                  linkedSessions.map((session) => h('option', {
                    key: `${session.source || 'dsh'}:${session.id}`,
                    value: `session:${session.source || 'dsh'}:${session.id}`,
                  }, `${session.source === 'codex' ? 'Codex' : 'DSH'} · ${session.title || tr('agentUntitled')}`))) : null)),
            h('div', { className: 'wb-handoff-persist' },
              h('label', { className: 'wb-check' },
                h('input', { type: 'checkbox', checked: persistProject, disabled: busy, onChange: (event) => { setPersistProject(event.target.checked); if (!event.target.checked) setPersistAgents(false) } }),
                h('b', null, tr('handoffPersist'))),
              h('div', { className: 'wb-handoff-hint' }, tr('handoffPersistHint')),
              persistProject ? h('label', { className: 'wb-check wb-handoff-agents' },
                h('input', { type: 'checkbox', checked: persistAgents, disabled: busy, onChange: (event) => setPersistAgents(event.target.checked) }),
                tr('handoffPersistAgents')) : null),
            h('div', { className: 'wb-handoff-field' },
              h('div', { className: 'wb-handoff-label' }, tr('handoffPreview')),
              h('textarea', {
                ref: previewRef,
                className: 'wb-textarea wb-handoff-preview',
                value: prompt,
                readOnly: true,
                spellCheck: false,
              })),
            selectedSession ? null : h('div', { className: 'wb-handoff-hint' }, targetApp === 'dsh' ? tr('handoffHint') : tr('inheritPackOnly')),
            replaceNeeded ? h('div', { className: 'wb-delete-warning wb-handoff-warning' },
              h(Glyph, { name: 'alert', size: 15 }),
              h('div', null,
                h('div', null, tr('handoffDraftWarning')),
                h('button', { className: 'wb-btn', onClick: () => submit(true), disabled: busy }, tr('handoffDraftReplace')))) : null,
            error ? h('div', { className: 'wb-modal-error' }, error) : null),
          h('div', { className: 'wb-modal-foot' },
            h('button', { className: 'wb-btn ghost', onClick: copy, disabled: busy },
              h(Glyph, { name: 'copy', size: 14 }), tr('handoffCopy')),
            h('span', { className: 'grow' }),
            h('button', { className: 'wb-btn ghost', onClick: onClose, disabled: busy }, tr('cancel')),
            h('button', {
              className: 'wb-btn primary',
              onClick: () => submit(false),
              disabled: busy || !goal.trim(),
            }, h(Glyph, { name: 'spark', size: 14 }), busy
              ? tr('handoffStarting')
              : selectedSession ? tr('handoffExistingOpen')
              : targetApp === 'opencode' ? tr('inheritOpenCode')
              : targetApp === 'dsh' ? tr('handoffStart')
              : targetApp === 'codex' ? tr('inheritCodex')
              : targetApp === 'comfyui' ? tr('inheritComfy')
              : tr('inheritOther')))))
    }

    function WorkspaceArtifact({ artifact, tr, featured = false }) {
      const isImage = artifact.kind === 'image' && artifact.url
      const isVideo = artifact.kind === 'video' && artifact.url
      const open = () => { if (artifact.url) window.open(artifact.url, '_blank', 'noopener,noreferrer') }
      return h('article', {
        className: cx('wb-ws-art', featured && 'is-featured', artifact.url && 'is-openable'),
        title: artifact.path,
        role: artifact.url ? 'button' : undefined,
        tabIndex: artifact.url ? 0 : undefined,
        onClick: artifact.url ? open : undefined,
        onKeyDown: artifact.url ? (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open() } } : undefined,
      },
        h('div', { className: 'wb-ws-art-media' },
          h('div', { className: 'wb-ws-art-placeholder' },
            h(Glyph, { name: artifact.kind === 'data' ? 'overview' : artifact.kind === 'video' ? 'arrow' : 'box', size: featured ? 30 : 22 }),
            h('span', null, artifact.kind || tr('runtimeArtifacts'))),
          isImage ? h('img', { src: artifact.url, alt: artifact.title, loading: 'lazy', onError: (event) => { event.currentTarget.style.display = 'none' } })
          : isVideo ? h('video', { src: artifact.url, controls: true, preload: 'metadata', onError: (event) => { event.currentTarget.style.display = 'none' } })
          : null),
        h('div', { className: 'wb-ws-art-body' },
          h('div', { className: 'wb-ws-art-title' }, artifact.title),
          h('div', { className: 'wb-ws-art-meta' },
            artifact.kind ? h('span', null, artifact.kind) : null,
            artifact.sizeBytes ? h('span', null, fmtBytes(artifact.sizeBytes)) : null,
            artifact.createdAt ? h('span', null, relTime(artifact.createdAt, tr)) : null),
          artifact.preview ? h('p', { className: 'wb-ws-art-preview' }, truncate(artifact.preview, 180)) : null))
    }

    function WorkspaceRuntime({ runtime, tr }) {
      if (!runtime) return h('div', { className: 'wb-ws-empty small' }, h(Glyph, { name: 'clock', size: 17 }), tr('wsNoRuntime'))
      const stages = runtimeStages(runtime)
      const done = stages.filter((stage) => stage.state === 'done').length
      const stageLabel = runtime.stage?.label || runtime.message || ''
      return h('div', { className: cx('wb-ws-runtime', `is-${runtime.state}`, runtime.stale && 'is-stale') },
        h('div', { className: 'wb-ws-runtime-head' },
          h(RuntimeStateBadge, { runtime, tr }),
          stageLabel ? h('div', { className: 'wb-ws-runtime-stage' }, stageLabel) : null,
          runtime.progress > 0 ? h('div', { className: 'wb-ws-progress' }, h('i', { style: { width: `${Math.round(runtime.progress * 100)}%` } })) : null),
        h('div', { className: 'wb-ws-runtime-facts' },
          h('span', null, h('b', null, tr('wsArtifactsCount', { n: runtime.artifacts?.length || 0 }))),
          h('span', null, `${tr('runtimeHeartbeat')} ${runtime.heartbeatAt ? relTime(runtime.heartbeatAt, tr) : '—'}`),
          stages.length ? h('span', null, tr('runtimeStagesDone', { done, total: stages.length })) : null,
          runtime.source ? h('span', null, statusSourceLabel(runtime.source, tr)) : null),
        stages.length ? h('div', { className: 'wb-ws-pipeline' }, stages.map((stage, index) => h('span', {
          key: stage.id || stage.label || index, className: cx('wb-ws-pipe', `is-${stage.state || 'pending'}`),
          title: stage.label || '',
        }, h('i'), stage.label || `Step ${index + 1}`))) : null,
        runtime.health?.length ? h('div', { className: 'wb-ws-health' }, runtime.health.map((item, index) => h('span', { key: index }, h(Glyph, { name: 'alert', size: 12 }), item.message || String(item)))) : null)
    }

    function WorkspaceSessionRow({ session, tr, onOpenSession, onForkSession, onUnlinkSession, onSetMain, onMarkContinuation, onMarkSide, busy, compact = false }) {
      const role = session.role || 'unassigned'
      const roleLabel = role === 'main' ? tr('lineageMain')
        : role === 'main-candidate' ? tr('lineageCandidate')
        : role === 'continuation' ? tr('lineageContinuation')
        : role === 'side' ? tr('lineageSide')
        : tr('lineageUnassigned')
      return h('div', { className: cx('wb-ws-session', compact && 'is-compact', `is-lineage-${role}`) },
        h('span', { className: 'wb-ws-session-dot', 'data-running': session.running ? '1' : '0' }),
        h('div', { className: 'wb-ws-session-main' },
          h('div', { className: 'wb-ws-session-title', title: session.title || session.id }, session.title || tr('agentUntitled')),
          h('div', { className: 'wb-ws-session-meta' },
            h('span', null, relTime(session.updatedAt, tr)),
            h('span', { className: 'wb-chip' }, session.source === 'codex' ? 'Codex' : 'DSH'),
            h('span', { className: cx('wb-chip', `is-lineage-${role}`) }, roleLabel),
            session.manual ? h('span', { className: 'wb-chip accent' }, tr('sessionManual')) : null,
            session.parentSessionId ? h('span', { className: 'wb-chip', title: session.parentSessionId }, tr('sessionForked')) : null,
            session.brokenParent ? h('span', { className: 'wb-chip' }, tr('lineageBrokenParent')) : null)),
        h('div', { className: 'wb-ws-session-actions' },
          !compact && role !== 'main' && onSetMain ? h('button', { className: 'wb-btn ghost', onClick: () => onSetMain(session.id) }, tr('lineageSetMain')) : null,
          !compact && role === 'unassigned' && onMarkContinuation ? h('button', { className: 'wb-btn ghost', onClick: () => onMarkContinuation(session.id) }, tr('lineageMarkContinuation')) : null,
          !compact && role !== 'main' && role !== 'main-candidate' && onMarkSide ? h('button', { className: 'wb-btn ghost', onClick: () => onMarkSide(session.id) }, tr('lineageMarkSide')) : null,
          onForkSession && session.source !== 'codex' ? h('button', { className: 'wb-btn ghost icon', title: tr('sessionForkAction'), onClick: () => onForkSession(session.id) }, h(Glyph, { name: 'fork', size: 13 })) : null,
          onOpenSession ? h('button', { className: 'wb-btn ghost', onClick: () => onOpenSession(session.id, session.source) }, tr('agentOpenSession')) : null,
          onUnlinkSession && session.manual ? h('button', { className: 'wb-btn ghost icon', title: tr('sessionUnlink'), disabled: busy, onClick: () => onUnlinkSession(session.id, session.source) }, h(Glyph, { name: 'close', size: 13 })) : null))
    }

    function CapabilityPane({ project, sessions, artifacts, memoryState, handoffHistory, projectSkills, skillsScan, tr, onHandoff, notify }) {
      const integration = project.identity?.integration || {}
      const mode = integrationLevel(integration)
      const entry = integration.entry || {}
      const roleCounts = sessions.reduce((counts, session) => {
        const role = session.role || 'unassigned'
        counts[role] = (counts[role] || 0) + 1
        return counts
      }, {})
      const evidence = [
        ['folders', tr('capEvidenceFolders'), project.folderCount || (project.path ? 1 : 0), 'discovered', tr('capDiscoveredHint')],
        ['sessions', tr('capEvidenceSessions'), sessions.length, sessions.some((session) => session.role === 'main') ? 'verified' : sessions.length ? 'discovered' : 'unavailable', sessions.length ? tr('lineageSub') : tr('capNoSessions')],
        ['skills', tr('capEvidenceSkills'), projectSkills.length, projectSkills.length ? 'discovered' : 'unavailable', projectSkills.length ? tr('capDiscoveredHint') : tr('capSkillsEmpty')],
        ['outputs', tr('capEvidenceOutputs'), artifacts.length, artifacts.length ? 'verified' : 'unavailable', artifacts.length ? tr('wsOutputsSub', { n: artifacts.length }) : tr('wsNoOutputs')],
        ['tool', tr('capEvidenceTool'), mode === 'index' ? tr('integrationChipIndex') : integrationChipLabel(mode, tr), mode === 'app' ? 'declared' : mode === 'project' ? 'discovered' : 'unavailable', tr(mode === 'app' ? 'capToolApp' : mode === 'project' ? 'capToolProject' : 'capToolIndex')],
        ['quality', tr('capEvidenceQuality'), tr('capNoAcceptanceShort'), 'unavailable', tr('capNoAcceptance')],
      ]
      const stateLabel = (state) => tr(state === 'verified' ? 'capStateVerified' : state === 'discovered' ? 'capStateDiscovered' : state === 'declared' ? 'capStateDeclared' : 'capStateUnavailable')
      const toolState = mode === 'index' ? tr('capToolIndex') : mode === 'project' ? tr('capToolProject') : mode === 'app' ? tr('capToolApp') : tr('capToolUnknown')
      const handoffText = memoryState?.goal || memoryState?.summary || memoryState?.progress || ''
      const copyPath = async (value) => {
        const ok = await copyText(String(value || ''))
        notify?.(ok ? tr('skillCopied') : tr('handoffCopyFailed'))
      }
      return h('div', { className: 'wb-cap' },
        h('div', { className: 'wb-cap-head' },
          h('div', { className: 'wb-room-kicker' }, h('span', { className: 'wb-cap-mark' }, h(Glyph, { name: 'spark', size: 13 })), tr('capKicker')),
          h('h2', null, tr('capTitle')),
          h('p', null, tr('capIntro'))),
        h('div', { className: 'wb-cap-metrics' },
          h('div', null, h('b', null, String(project.folderCount || (project.path ? 1 : 0))), h('span', null, tr('projectFolders'))),
          h('div', null, h('b', null, String(sessions.length)), h('span', null, tr('wsSessions'))),
          h('div', null, h('b', null, String(projectSkills.length)), h('span', null, tr('skills'))),
          h('div', null, h('b', null, String(artifacts.length)), h('span', null, tr('wsOutputs')))),
        h('div', { className: 'wb-cap-grid' },
          h('section', { className: 'wb-cap-block' },
            h('div', { className: 'wb-cap-label' }, h('span', null, '01'), tr('capHow')),
            h('h3', null, integrationLevelLabel(mode, tr)),
            h('p', null, toolState),
            h('dl', { className: 'wb-cap-kv' },
              h('div', null, h('dt', null, tr('integrationEntry')), h('dd', null, entry.value ? h('code', null, entry.value) : tr('integrationNoEntry'))),
              h('div', null, h('dt', null, tr('integrationState')), h('dd', null, integration.state?.length ? integration.state.join(' · ') : '—')),
              h('div', null, h('dt', null, tr('integrationAgent')), h('dd', null, integration.agent || '—'))),
            h('div', { className: 'wb-cap-actions' },
              onHandoff ? h('button', { className: 'wb-btn primary', onClick: () => onHandoff(project) }, h(Glyph, { name: 'spark', size: 13 }), tr('capOpenHandoff')) : null,
              h('button', { className: 'wb-btn ghost', onClick: () => copyPath(project.path) }, tr('copyPath')))),
          h('section', { className: 'wb-cap-block' },
            h('div', { className: 'wb-cap-label' }, h('span', null, '02'), tr('capBoundary')),
            h('h3', null, tr('capNoTool')),
            h('p', null, tr('capBoundaryText')),
            h('div', { className: 'wb-cap-submit' },
              h('div', null, h('b', null, tr('capSubmit')), h('span', null, project.runtime?.stage?.label || project.runtime?.message || tr('runtimeUnknown'))),
              h('div', null, h('b', null, tr('capAcceptance')), h('span', { className: 'is-warn' }, tr('capNoAcceptance')))))),
        h('section', { className: 'wb-cap-section' },
          h('div', { className: 'wb-cap-label' }, h('span', null, '03'), tr('capEvidence')),
          h('p', { className: 'wb-cap-section-sub' }, tr('capEvidenceSub')),
          h('div', { className: 'wb-cap-evidence' }, evidence.map(([id, label, value, state, hint]) => h('div', { className: 'wb-cap-evidence-row', key: id },
            h('span', { className: 'wb-cap-evidence-name' }, label),
            h('b', null, String(value)),
            h('span', { className: `wb-cap-state is-${state}` }, stateLabel(state)),
            h('span', { className: 'wb-cap-evidence-hint' }, hint))))),
        h('section', { className: 'wb-cap-section' },
          h('div', { className: 'wb-cap-label' }, h('span', null, '04'), tr('capSessionsTitle')),
          sessions.length
            ? h('div', { className: 'wb-cap-session-list' }, sessions.slice(0, 6).map((session) => h('div', {
                className: 'wb-cap-session-row',
                key: `${session.source || 'dsh'}:${session.id}`,
              },
                h('span', { className: 'wb-cap-session-source' }, session.source === 'codex' ? 'CODEX' : 'DSH'),
                h('span', { className: 'wb-cap-session-title' }, session.title || session.id),
                h('span', { className: 'wb-cap-session-role' }, tr(session.role === 'main' ? 'lineageMain' : session.role === 'main-candidate' ? 'lineageCandidate' : session.role === 'continuation' ? 'lineageContinuation' : session.role === 'side' ? 'lineageSide' : 'lineageUnassigned')))))
            : h('p', { className: 'wb-cap-empty' }, tr('capNoSessions'))),
        h('section', { className: 'wb-cap-section' },
          h('div', { className: 'wb-cap-label' }, h('span', null, '05'), tr('capSkillsTitle')),
            h('p', { className: 'wb-cap-section-sub' }, skillsScan === 'loading' ? tr('skillScanning') : tr('capSkillsHint')),
          projectSkills.length ? h('div', { className: 'wb-cap-skill-list' }, projectSkills.map((skill) => h('div', { className: 'wb-cap-skill-row', key: skill.id },
            h('span', { className: 'wb-cap-skill-name' }, skill.name),
            h('span', { className: 'wb-cap-skill-origin' }, skill.origin === 'authored' ? tr('skillAuthored') : tr('skillInstalled')),
            h('code', { title: skill.path }, skill.path),
            h('button', { className: 'wb-btn ghost', onClick: () => copyPath(skill.path) }, tr('skillCopy'))))) : h('p', { className: 'wb-cap-empty' }, skillsScan === 'loading' ? tr('skillScanning') : tr('capSkillsEmpty'))),
        h('section', { className: 'wb-cap-section' },
          h('div', { className: 'wb-cap-label' }, h('span', null, '06'), tr('capHandoff')),
          handoffText ? h('div', { className: 'wb-cap-handoff' },
            h('p', null, handoffText),
            h('div', { className: 'wb-cap-handoff-meta' }, h('span', null, memoryState?.updatedAt ? fmtDateTime(memoryState.updatedAt) : '—'), h('span', null, handoffHistory?.[0]?.status || tr('capNoHandoffStatus')))) : h('p', { className: 'wb-cap-empty' }, tr('capNoHandoff'))))
    }

    function workspaceOriginLabel(scene) {
      if (scene === 'earth') return 'sceneEarth'
      if (scene === 'studio') return 'sceneStudio'
      if (scene === 'library') return 'sceneLibrary'
      return null
    }

    function WorkspaceOriginMark({ scene }) {
      const shared = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.1, opacity: .75 }
      let drawing = null
      if (scene === 'earth') drawing = h('g', shared,
        h('circle', { cx: 110, cy: 80, r: 54 }),
        h('ellipse', { cx: 110, cy: 80, rx: 23, ry: 54 }),
        h('ellipse', { cx: 110, cy: 80, rx: 54, ry: 19 }),
        h('path', { d: 'M62 55 Q110 69 158 55 M62 105 Q110 91 158 105' }),
        h('ellipse', { cx: 110, cy: 80, rx: 95, ry: 38, transform: 'rotate(-18 110 80)', strokeDasharray: '3 6', opacity: .6 }))
      else if (scene === 'studio') drawing = h('g', shared,
        h('path', { d: 'M22 35 H198 V125 H22 Z M22 64 H198 M75 35 V125 M148 35 V125' }),
        h('rect', { x: 36, y: 77, width: 25, height: 16 }), h('rect', { x: 90, y: 78, width: 25, height: 16 }),
        h('rect', { x: 119, y: 78, width: 19, height: 16 }), h('rect', { x: 160, y: 76, width: 26, height: 18 }),
        h('path', { d: 'M39 47 H57 M88 48 H130 M161 47 H184 M39 107 H59 M94 107 H136 M163 108 H183' }))
      else if (scene === 'library') drawing = h('g', shared,
        h('path', { d: 'M22 126 V45 Q22 27 40 27 H180 Q198 27 198 45 V126 M22 126 H198' }),
        h('path', { d: 'M40 47 H180 M40 84 H180 M40 121 H180' }),
        [48, 60, 72, 89, 101, 119, 132, 150, 163].map((x, index) => h('path', { key: x, d: `M${x} 52 v27 M${x + 3} 89 v27`, opacity: .6 + (index % 2) * .3 })))
      if (!drawing) return null
      return h('svg', { className: 'wb-field-origin', viewBox: '0 0 220 160', 'aria-hidden': 'true', focusable: 'false' }, drawing)
    }

    function ProjectWorkspace({ project, projects, allSessions, sessionSources, scene, tr, initialTab = 'overview', onTabChange, onClose, onSave, onOpen, onSelect, onHandoff, onLinkFolder, onUnlinkFolder, onOpenSession, onForkSession, onLinkSession, onUnlinkSession, onMarkFollowup, onSetLifecycle, onSetSessionPolicy, notify, exitGuardRef }) {
      const [tab, setTab] = useState(['overview', 'capability', 'outputs', 'sessions', 'settings'].includes(initialTab) ? initialTab : 'overview')
      const taskStarter = tr('wsTaskStarter')
      const [note, setNote] = useState(project.note || '')
      const [tags, setTags] = useState((project.tags || []).join(', '))
      const [status, setStatus] = useState(project.status || 'unknown')
      const [lifecycle, setLifecycle] = useState(project.lifecycle || 'unclassified')
      const [intent, setIntent] = useState(project.identity?.intent || '')
      const integration = project.identity?.integration || {}
      const integrationMode = integrationLevel(integration)
      const [lifecycleBusy, setLifecycleBusy] = useState(false)
      const [pinned, setPinned] = useState(Boolean(project.pinned))
      const [hidden, setHidden] = useState(Boolean(project.hidden))
      const [saving, setSaving] = useState(false)
      const [savedSnapshot, setSavedSnapshot] = useState(null)
      const [folderPath, setFolderPath] = useState('')
      const [folderRole, setFolderRole] = useState('reference')
      const [folderBusy, setFolderBusy] = useState(false)
      const [sessionPick, setSessionPick] = useState('')
      const [sessionBusy, setSessionBusy] = useState(false)
      const [taskDraft, setTaskDraft] = useState(taskStarter)
      const [taskOpen, setTaskOpen] = useState(false)
      const [memory, setMemory] = useState(null)
      const [memoryBusy, setMemoryBusy] = useState(false)
      const [handoffHistory, setHandoffHistory] = useState([])
      const [projectSkills, setProjectSkills] = useState([])
      const [skillsScan, setSkillsScan] = useState('idle')
      const titleRef = useRef(null)
      const sectionRef = useRef(null)
      const leavingRef = useRef(false)
      const zoomBackRef = useRef(false)
      // Updated on every render so a save cannot silently discard edits made
      // while its request is in flight.
      const workspaceEditSnapshotRef = useRef('')
      workspaceEditSnapshotRef.current = JSON.stringify([project.id, note, tags, status, pinned, hidden, lifecycle, intent, taskDraft])
      const workspaceSaveFields = { id: project.id, note, tags, status, pinned, hidden }
      const workspaceSaveFieldsRef = useRef('')
      workspaceSaveFieldsRef.current = workspaceSaveSnapshot(workspaceSaveFields)
      const saved = workspaceSaveIsCurrent(savedSnapshot, workspaceSaveFields)
      const [zoomingBack, setZoomingBack] = useState(false)
      const candidates = useMemo(() => (allSessions || [])
        .filter((session) => !session.projectId)
        .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
        .slice(0, 100), [allSessions])
      const sourceWarnings = useMemo(() => [
        ['DSH', sessionSources?.dsh], ['Codex', sessionSources?.codex],
      ].filter(([, source]) => source && source.available === false), [sessionSources])
      useEffect(() => {
        setTab(initialTab || 'overview'); setNote(project.note || ''); setTags((project.tags || []).join(', ')); setStatus(project.status || 'unknown'); setPinned(Boolean(project.pinned)); setHidden(Boolean(project.hidden)); setSavedSnapshot(null); leavingRef.current = false; zoomBackRef.current = false; setZoomingBack(false)
        setLifecycle(project.lifecycle || 'unclassified'); setIntent(project.identity?.intent || ''); setLifecycleBusy(false)
        setFolderPath(''); setFolderRole('reference'); setFolderBusy(false); setSessionPick(''); setSessionBusy(false); setProjectSkills([]); setSkillsScan('idle'); setTaskDraft(taskStarter); setTaskOpen(false)
        const id = window.setTimeout(() => titleRef.current?.focus({ preventScroll: true }), 20)
        return () => window.clearTimeout(id)
      }, [project.id])
      useEffect(() => { setTab(initialTab || 'overview') }, [initialTab])
      useEffect(() => {
        const root = sectionRef.current
        const main = root?.closest('.wb-main')
        if (!root || !main) return undefined
        let raf = 0
        const update = () => {
          raf = 0
          const max = Math.max(0, main.scrollHeight - main.clientHeight)
          const progress = max ? Math.min(1, Math.max(0, main.scrollTop / max)) : 0
          root.style.setProperty('--wb-room-scroll', String(progress))
          root.style.setProperty('--wb-room-cover-scale', String(1.02 + progress * .07))
          root.style.setProperty('--wb-room-cover-shift', `${-7 * progress}px`)
        }
        const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
        update()
        main.addEventListener('scroll', onScroll, { passive: true })
        const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(onScroll) : null
        resize?.observe(main)
        const reveal = typeof IntersectionObserver === 'function' ? new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return
            entry.target.classList.add('is-revealed')
            reveal.unobserve(entry.target)
          })
        }, { root: main, threshold: .08 }) : null
        root.querySelectorAll('.wb-ws-pane.is-overview .wb-ws-section').forEach((section) => reveal?.observe(section))
        return () => {
          cancelAnimationFrame(raf)
          main.removeEventListener('scroll', onScroll)
          resize?.disconnect()
          reveal?.disconnect()
        }
      }, [project.id, tab])
      const loadMemory = useCallback(async () => {
        if (!project.id) return
        setMemoryBusy(true)
        try {
          const response = await fetch(`${API}/project-handoff?projectId=${encodeURIComponent(project.id)}`, { cache: 'no-store' })
          const result = await response.json().catch(() => ({}))
          if (response.ok && result.ok !== false) setMemory(result)
        } catch { /* memory is optional; the room still works without it */ } finally { setMemoryBusy(false) }
      }, [project.id])
      const loadHandoffHistory = useCallback(async () => {
        if (!project.id) return
        try {
          const response = await fetch(`${API}/handoffs?projectId=${encodeURIComponent(project.id)}`, { cache: 'no-store' })
          const result = await response.json().catch(() => ({}))
          if (response.ok && result.ok !== false) setHandoffHistory(Array.isArray(result.handoffs) ? result.handoffs : [])
        } catch { /* history is optional; the room still works without it */ }
      }, [project.id])
      const skillRoots = useMemo(() => {
        const slash = String.fromCharCode(92)
        const norm = (value) => String(value || '').split('/').join(slash).replace(new RegExp(slash + '+$'), '').toLowerCase()
        const values = [project.path, ...(Array.isArray(project.folders) ? project.folders : []).map((folder) => folder?.path || folder)]
        return [...new Set(values.filter(Boolean).map(norm))]
      }, [project.path, project.folders])
      useEffect(() => {
        if (tab !== 'capability' || skillsScan !== 'idle' || !skillRoots.length) return
        let live = true
        setSkillsScan('loading')
        const slash = String.fromCharCode(92)
        const norm = (value) => String(value || '').split('/').join(slash).toLowerCase()
        fetch(`${API}/skills`, { cache: 'no-store' })
          .then((response) => response.json())
          .then((result) => {
            if (!live || !result?.ok || !Array.isArray(result.skills)) return
            const matches = result.skills.filter((skill) => {
              const file = norm(skill.path)
              return skillRoots.some((root) => file.startsWith(root + slash))
            })
            setProjectSkills(matches)
          })
          .catch(() => {})
          .finally(() => { if (live) setSkillsScan('done') })
        return () => { live = false }
      }, [tab, project.id, skillRoots])
      const setHandoffStatus = useCallback(async (handoffId, status) => {
        try {
          const response = await fetch(`${API}/handoffs`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: handoffId, status }),
          })
          const result = await response.json().catch(() => ({}))
          if (!response.ok || result.ok === false) throw new Error(result.error || `HTTP ${response.status}`)
          await loadHandoffHistory()
          notify?.(tr(`handoffStatus${status === 'completed' ? 'Completed' : 'Failed'}`))
          return true
        } catch (error) {
          notify?.(`${tr('handoffRecordStatusFailed')}：${error?.message || error}`)
          return false
        }
      }, [loadHandoffHistory, notify, tr])
      useEffect(() => {
        loadMemory()
        loadHandoffHistory()
        const onSaved = (event) => {
          if (!event.detail?.projectId || event.detail.projectId === project.id) {
            loadMemory()
            loadHandoffHistory()
          }
        }
        window.addEventListener('wb-handoff-saved', onSaved)
        return () => window.removeEventListener('wb-handoff-saved', onSaved)
      }, [loadMemory, loadHandoffHistory, project.id])
      const children = projects.filter((p) => p.parentId === project.id)
      const parent = project.parentId ? projects.find((p) => p.id === project.parentId) : null
      const normalizedTags = tags.split(',').map((x) => x.trim()).filter(Boolean)
      const dirty = note !== (project.note || '') || tags !== (project.tags || []).join(', ') || status !== (project.status || 'unknown') || pinned !== Boolean(project.pinned) || hidden !== Boolean(project.hidden)
      const persist = useCallback(async (patch = {}) => {
        const snapshot = workspaceSaveSnapshot({ id: project.id, note, tags, status, pinned, hidden })
        setSaving(true)
        try {
          const result = await onSave(project.id, { note, tags: normalizedTags, status, pinned, hidden, ...patch })
          if (result?.ok === false) return false
          setSavedSnapshot(snapshot)
          if (workspaceSaveFieldsRef.current === snapshot) notify?.(tr('savedToast'))
          window.setTimeout(() => setSavedSnapshot((current) => current === snapshot ? null : current), 1800)
          return true
        } catch (error) {
          notify?.(`${tr('saveFailed')}：${error?.message || error}`)
          return false
        } finally { setSaving(false) }
      }, [project.id, note, tags, status, pinned, hidden, onSave, notify, tr])
      const save = useCallback(() => persist(), [persist])
      const saveLifecycle = useCallback(async (value = lifecycle) => {
        if (!onSetLifecycle) return false
        setLifecycleBusy(true)
        try {
          const result = await onSetLifecycle(project.id, { lifecycle: value, intent })
          if (result?.ok === false) throw new Error(result.error || tr('roomLifecycleFailed'))
          setLifecycle(value)
          notify?.(tr('roomLifecycleSaved'))
          return true
        } catch (error) { notify?.(`${tr('roomLifecycleFailed')}：${error?.message || error}`); return false } finally { setLifecycleBusy(false) }
      }, [onSetLifecycle, project.id, lifecycle, intent, tr, notify])
      const intentDirty = intent !== (project.identity?.intent || '')
      const taskDirty = taskDraft !== taskStarter
      const pendingChanges = dirty || intentDirty || taskDirty
      const saveBeforeLeaving = useCallback(async () => {
        const snapshot = workspaceEditSnapshotRef.current
        const unchanged = () => workspaceEditSnapshotRef.current === snapshot
        const result = await savePendingWorkspaceChanges({
          taskDirty, confirmDiscard: () => window.confirm(tr('wsDiscardTaskConfirm')), dirty, save, intentDirty, saveLifecycle, unchanged,
        })
        if (!result && !unchanged()) notify?.(tr('wsChangedDuringSave'))
        return result
      }, [taskDirty, dirty, intentDirty, save, saveLifecycle, tr, notify])
      useEffect(() => {
        if (!exitGuardRef) return undefined
        const guard = { dirty: pendingChanges, save: saveBeforeLeaving }
        exitGuardRef.current = guard
        return () => { if (exitGuardRef.current === guard) exitGuardRef.current = null }
      }, [exitGuardRef, pendingChanges, saveBeforeLeaving])
      useEffect(() => {
        if (!pendingChanges) return undefined
        const warn = (event) => { event.preventDefault(); event.returnValue = '' }
        window.addEventListener('beforeunload', warn)
        return () => window.removeEventListener('beforeunload', warn)
      }, [pendingChanges])
      const leave = useCallback(async () => {
        return attemptWorkspaceLeave(leavingRef, pendingChanges, saveBeforeLeaving, onClose)
      }, [pendingChanges, saveBeforeLeaving, onClose])
      const pullBack = useCallback(async () => {
        if (zoomBackRef.current || leavingRef.current) return
        zoomBackRef.current = true
        setZoomingBack(true)
        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
        if (reduced) {
          const ok = await leave()
          if (!ok) { zoomBackRef.current = false; setZoomingBack(false) }
          return
        }
        window.setTimeout(async () => {
          const ok = await leave()
          if (!ok) { zoomBackRef.current = false; setZoomingBack(false) }
        }, 180)
      }, [leave])
      useEffect(() => {
        const root = sectionRef.current
        const main = document.querySelector('.wb-main')
        if (!root || !main) return undefined
        let acc = 0
        let last = 0
        const onWheel = (event) => {
          if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
          if (event.deltaY >= 0) { acc = 0; return }
          if (main.scrollTop > 2) { acc = 0; return }
          const target = event.target
          if (target instanceof Element && target.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]')) { acc = 0; return }
          const now = performance.now()
          if (now - last > 260) acc = 0
          last = now
          acc += Math.abs(event.deltaY)
          if (acc < 48) return
          event.preventDefault()
          acc = 0
          pullBack()
        }
        root.addEventListener('wheel', onWheel, { passive: false })
        return () => root.removeEventListener('wheel', onWheel)
      }, [pullBack])
      const addFolder = useCallback(async () => {
        const target = folderPath.trim()
        if (!target) return
        setFolderBusy(true)
        try {
          const result = await onLinkFolder(project.id, target, folderRole)
          if (result?.ok === false) throw new Error(result.error || tr('folderAddFailed'))
          setFolderPath(''); notify?.(tr('folderAdded'))
        } catch (error) { notify?.(`${tr('folderAddFailed')}：${error?.message || error}`) } finally { setFolderBusy(false) }
      }, [folderPath, folderRole, onLinkFolder, project.id, notify, tr])
      const removeFolder = useCallback(async (folder) => {
        setFolderBusy(true)
        try {
          const result = await onUnlinkFolder(project.id, folder.path)
          if (result?.ok === false) throw new Error(result.error || tr('folderAddFailed'))
          notify?.(tr('folderRemoved'))
        } catch (error) { notify?.(`${tr('folderAddFailed')}：${error?.message || error}`) } finally { setFolderBusy(false) }
      }, [onUnlinkFolder, project.id, notify, tr])
      const linkSession = useCallback(async () => {
        const picked = candidates.find((session) => session.id === sessionPick) || candidates[0]
        if (!picked?.id) return
        setSessionBusy(true)
        try {
          const result = await onLinkSession(project.id, picked.id, picked.source || 'dsh')
          if (result?.ok === false) throw new Error(result.error || tr('sessionLinkFailed'))
          setSessionPick(''); notify?.(tr('sessionLinked'))
        } catch (error) { notify?.(`${tr('sessionLinkFailed')}：${error?.message || error}`) } finally { setSessionBusy(false) }
      }, [sessionPick, candidates, onLinkSession, project.id, notify, tr])
      const unlinkSession = useCallback(async (sessionId, source = 'dsh') => {
        setSessionBusy(true)
        try {
          const result = await onUnlinkSession(project.id, sessionId, source)
          if (result?.ok === false) throw new Error(result.error || tr('sessionLinkFailed'))
          notify?.(tr('sessionUnlinked'))
        } catch (error) { notify?.(`${tr('sessionLinkFailed')}：${error?.message || error}`) } finally { setSessionBusy(false) }
      }, [onUnlinkSession, project.id, notify, tr])
      useEffect(() => {
        const fn = (event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); save() }
        }
        window.addEventListener('keydown', fn)
        return () => window.removeEventListener('keydown', fn)
      }, [save])
      const git = project.git || {}
      const artifacts = project.runtime?.artifacts || []
      const workspaceMedia = useProjectMedia(project.id, project.representativeImage?.path || '')
      const fromEarthLanding = useMemo(() => {
        if (scene !== 'earth') return false
        try {
          const snapshot = JSON.parse(sessionStorage.getItem(EARTH_RETURN_KEY) || 'null')
          return snapshot?.projectId === project.id && snapshot?.mode === 'landing'
        } catch { return false }
      }, [scene, project.id])
      const artifactMedia = artifacts.filter((artifact) => artifact.url || artifact.kind === 'image' || artifact.kind === 'video')
      const sessions = (project.sessions || []).slice().sort((a, b) => (Date.parse(b.updatedAt || '') || 0) - (Date.parse(a.updatedAt || '') || 0))
      const lineage = project.lineage && Array.isArray(project.lineage.items)
        ? project.lineage
        : { items: sessions.map((session) => ({ ...session, role: 'unassigned' })), rootConfirmed: false, mainSessionId: '', policy: project.sessionPolicy || {} }
      const lineageById = Object.fromEntries((lineage.items || []).map((item) => [item.id, item]))
      const sessionRows = sessions.map((session) => ({ ...session, ...(lineageById[session.id] || {}) }))
      const mainRow = sessionRows.find((session) => session.role === 'main') || sessionRows.find((session) => session.role === 'main-candidate') || null
      const continuationRows = sessionRows.filter((session) => session.role === 'continuation')
      const sideRows = sessionRows.filter((session) => session.role === 'side')
      const unassignedRows = sessionRows.filter((session) => session.role === 'unassigned')
      const policy = { rootSessionId: '', continuations: [], side: [], ...(project.sessionPolicy || {}), ...(lineage.policy || {}) }
      const setSessionPolicy = useCallback(async (patch) => {
        if (!onSetSessionPolicy) return false
        setSessionBusy(true)
        try {
          const result = await onSetSessionPolicy(project.id, { rootSessionId: policy.rootSessionId || '', continuations: policy.continuations || [], side: policy.side || [], ...patch })
          if (result?.ok === false) throw new Error(result.error || tr('sessionLineageFailed'))
          notify?.(tr('sessionLineageSaved'))
          return true
        } catch (error) { notify?.(`${tr('sessionLineageFailed')}：${error?.message || error}`); return false } finally { setSessionBusy(false) }
      }, [onSetSessionPolicy, project.id, policy.rootSessionId, policy.continuations, policy.side, tr, notify])
      const markMain = (sessionId) => setSessionPolicy({
        rootSessionId: sessionId,
        continuations: (policy.continuations || []).filter((id) => id !== sessionId),
        side: (policy.side || []).filter((id) => id !== sessionId),
      })
      const markContinuation = (sessionId) => setSessionPolicy({
        ...(policy.rootSessionId ? {} : (mainRow ? { rootSessionId: mainRow.id } : {})),
        continuations: Array.from(new Set([...(policy.continuations || []), sessionId])),
        side: (policy.side || []).filter((id) => id !== sessionId),
      })
      const markSide = (sessionId) => setSessionPolicy({
        continuations: (policy.continuations || []).filter((id) => id !== sessionId),
        side: Array.from(new Set([...(policy.side || []), sessionId])),
      })
      const latestSession = sessions[0]
      const markDone = async () => { if (dirty && !(await save())) return; await onMarkFollowup?.(project.id, 'done') }
      const startTask = () => {
        const goal = taskDraft.trim()
        if (!goal || !project.path) return
        onHandoff?.(project, { mode: 'new', goal })
        setTaskDraft(taskStarter)
        setTaskOpen(false)
      }
      const focusComposer = () => {
        setTaskDraft((current) => current.trim() ? current : taskStarter)
        setTaskOpen(true)
        window.setTimeout(() => document.querySelector('.wb-room-command-row textarea')?.focus(), 90)
      }
      const toggleComposer = () => {
        if (taskOpen) {
          setTaskOpen(false)
          return
        }
        focusComposer()
      }
      const representative = workspaceMedia.data?.representative || null
      const preview = representative
        ? { kind: 'image', url: representative.url, title: representative.title || project.displayName || project.name, createdAt: representative.mtime }
        : artifactMedia.find((artifact) => artifact.kind === 'image' && artifact.url) || artifactMedia[0] || null
      const previewLabel = preview?.title && !/\.(png|jpe?g|webp|gif|mp4|mov|webm)$/i.test(preview.title) ? preview.title : tr('roomLatest')
      const chapters = [
        ['overview', tr('roomBrief'), ''],
        ['capability', tr('roomCapability'), ''],
        ['outputs', tr('roomEvidence'), artifacts.length ? String(artifacts.length) : ''],
        ['sessions', tr('wsSessions'), sessions.length ? String(sessions.length) : ''],
        ['settings', tr('roomSetup'), ''],
      ]
      const [paneDir, setPaneDir] = useState(1)
      const chooseChapter = (id, moveFocus = false) => {
        const from = chapters.findIndex(([value]) => value === tab)
        const to = chapters.findIndex(([value]) => value === id)
        setPaneDir(to >= from ? 1 : -1)
        setTab(id)
        onTabChange?.(id)
        if (moveFocus) requestAnimationFrame(() => document.querySelector(`[data-wb-chapter="${id}"]`)?.focus())
        requestAnimationFrame(() => {
          const scroller = document.querySelector('.wb-main')
          const body = document.querySelector('.wb-ws-body')
          if (!scroller || !body || scroller.scrollTop < 160) return
          const chrome = (document.querySelector('.wb-room-top')?.getBoundingClientRect().height || 0)
            + (document.querySelector('.wb-room-chapters')?.getBoundingClientRect().height || 0) + 8
          const top = scroller.scrollTop + body.getBoundingClientRect().top - scroller.getBoundingClientRect().top - chrome
          scroller.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 'auto' : 'smooth' })
        })
      }
      useEffect(() => {
        const onKey = (event) => {
          const target = event.target
          const typing = target && target.closest && target.closest('input,textarea,select,[contenteditable="true"]')
          if (handleWorkspaceEscape(event, { taskOpen, setTaskOpen, leave })) return
          if (typing || event.metaKey || event.ctrlKey || event.altKey) return
          const index = Number(event.key)
          if (index >= 1 && index <= chapters.length) {
            event.preventDefault()
            chooseChapter(chapters[index - 1][0], true)
            return
          }
          if (event.key.toLowerCase() === 'n') {
            event.preventDefault()
            if (tab !== 'overview') chooseChapter('overview')
            setTaskOpen(true)
            window.setTimeout(() => document.querySelector('.wb-room-command-row textarea')?.focus(), 90)
          }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [taskOpen, leave, tab])
      const memoryState = memory?.state || null
      const memoryPath = memory?.paths?.doc || (project.path ? `${project.path}\\.dsh\\handoff\\PROJECT_STATE.md` : '')
      const memoryUpdated = memoryState?.updatedAt ? relTime(memoryState.updatedAt, tr) : ''
      const originLabel = workspaceOriginLabel(scene)
      return h('section', { ref: sectionRef, className: cx('wb-ws wb-room wb-field', originLabel && `is-origin-${scene}`, zoomingBack && 'is-zooming-back'), 'aria-labelledby': 'wb-ws-title', style: { '--wb-room-accent': projectAccent(project) } },
        h('div', { className: 'wb-room-top' },
          h('button', { className: 'wb-room-back', onClick: leave, title: tr('roomWheelBackTitle') }, h(Glyph, { name: 'arrow', size: 14 }), tr(sceneBackLabel(scene, fromEarthLanding))),
          scene === 'earth' ? h('span', { className: 'wb-room-wheel-hint' }, h(Glyph, { name: 'mouse', size: 12 }), tr(fromEarthLanding ? 'roomWheelBack' : 'roomWheelBackEarth')) : null,
          h('div', { className: 'wb-room-crumb' },
            h(Glyph, { name: 'chevron', size: 10 }),
            h('span', null, project.workspace || tr('projectLabel')),
            parent ? h('button', { className: 'wb-link', onClick: () => onSelect(parent), title: parent.displayName || parent.name }, parent.displayName || parent.name) : null),
          h('div', { className: 'wb-room-top-actions' },
            onHandoff ? h('button', { className: 'wb-btn primary', onClick: () => onHandoff(project), disabled: !project.path }, h(Glyph, { name: 'spark', size: 14 }), tr('handoff')) : null,
            h('button', { className: 'wb-btn ghost wb-room-open', onClick: () => onOpen(project.path), 'aria-label': tr('openFolder') }, h(Glyph, { name: 'folder', size: 14 }), h('span', null, tr('openFolder'))))),
        h('div', { className: cx('wb-field-hero', !preview && 'is-empty') },
          preview ? h('button', { className: 'wb-field-media', type: 'button', onClick: () => chooseChapter('outputs'), 'aria-label': `${previewLabel} · ${tr('wsViewAllOutputs')}` },
            h('span', { className: 'wb-field-media-fallback' }, h('b', null, projectMark(project)), h('span', null, tr('roomNoCover'))),
            preview.kind === 'image' && preview.url
              ? h('img', { src: preview.url, alt: preview.title || '', loading: 'eager', onError: (event) => { event.currentTarget.style.display = 'none' } })
              : null,
            h('span', { className: 'wb-field-media-caption' },
              h('span', null, previewLabel),
              h('span', null, relTime(preview.createdAt || preview.mtime || project.lastActivity, tr))))
            : h('div', { className: 'wb-field-media is-empty', 'aria-hidden': 'true' },
              h('span', { className: 'wb-field-media-mark' }, projectMark(project)),
              h('span', { className: 'wb-field-media-word' }, 'FIELD')),
          h('div', { className: 'wb-field-wash' }),
          h(WorkspaceOriginMark, { scene }),
          h('div', { className: 'wb-room-identity wb-field-copy' },
            h('div', { className: 'wb-room-kicker wb-field-kicker' },
              h('span', { className: 'wb-room-mark' }, projectMark(project)),
              h('span', null, tr('roomKicker')),
              h('span', { className: cx('wb-field-index', originLabel && 'is-origin') }, originLabel ? tr(originLabel) : 'PROJECT / FIELD')),
            h('h1', { id: 'wb-ws-title', className: 'wb-room-title', 'data-wb-morph-title': '1', tabIndex: -1, ref: titleRef }, project.displayName || project.name),
            h('div', { className: 'wb-room-path', title: project.path }, project.path),
            h('div', { className: 'wb-room-chips' },
              h('span', { className: cx('wb-chip', `is-lineage-${project.lifecycle || 'unclassified'}`) }, lifecycleLabel(project.lifecycle, tr)),
              h('span', {
                className: cx('wb-chip', `is-integration-${integrationMode}`),
                title: integrationLevelLabel(integrationMode, tr),
              }, integrationChipLabel(integrationMode, tr)),
              project.runtime ? h(RuntimeStateBadge, { runtime: project.runtime, tr }) : h(StatusPill, { status, tr }),
              project.needsFollowup ? h('span', { className: 'wb-chip accent' }, tr('followupNew')) : null,
              project.pinned ? h('span', { className: 'wb-chip accent' }, tr('pinned')) : null,
              project.noise ? h('span', { className: 'wb-chip' }, project.noiseReason || 'cache') : null,
              h('span', { className: 'wb-chip' }, fmtBytes(project.sizeBytes)))),
          h('div', { className: 'wb-field-meta' },
            h('div', null, h('span', null, tr('lastActivity')), h('b', null, `${fmtDate(project.lastActivity)} · ${relTime(project.lastActivity, tr)}`)),
            h('div', null, h('span', null, tr('wsSessions')), h('b', null, String(sessions.length))),
            h('div', null, h('span', null, tr('files')), h('b', null, `${(project.fileCount || 0).toLocaleString()} · ${fmtBytes(project.sizeBytes)}`)),
            h('div', null, h('span', null, tr('roomMemory')), h('b', null, memoryState ? tr('roomMemoryNative') : tr('roomMemoryEmpty'))))),
        h('div', { className: 'wb-room-chapters', role: 'tablist', 'aria-label': tr('detailsFor') },
          chapters.map(([id, label, count], index) => h('button', {
            key: id, type: 'button', role: 'tab', id: `wb-ws-tab-${id}`, 'aria-controls': 'wb-ws-panel',
            'aria-selected': tab === id, tabIndex: tab === id ? 0 : -1, className: cx('wb-room-chapter', tab === id && 'on'),
            'data-wb-chapter': id,
            onClick: () => chooseChapter(id),
            onKeyDown: (event) => {
              const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End']
              if (!keys.includes(event.key)) return
              event.preventDefault()
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? chapters.length - 1
                : (index + (event.key === 'ArrowRight' ? 1 : -1) + chapters.length) % chapters.length
              chooseChapter(chapters[next][0], true)
            },
          }, h('small', null, String(index + 1).padStart(2, '0')), label, count ? h('span', { className: 'wb-room-count' }, count) : null))),
        project.needsFollowup ? h('div', { className: 'wb-ws-followup' },
          h(Glyph, { name: 'flag', size: 16 }),
          h('div', null, h('b', null, tr('followupNew')), h('span', null, `${tr('followupDiscovered', { t: relTime(project.discoveredAt, tr) })} · ${tr('followupHint')}`)),
          h('button', { className: 'wb-btn primary', disabled: !note.trim(), title: note.trim() ? tr('followupMark') : tr('followupNeedNote'), onClick: markDone }, h(Glyph, { name: 'check', size: 13 }), tr('followupMark'))) : null,
        h('div', { className: 'wb-ws-body' },
          h('div', { key: tab, id: 'wb-ws-panel', 'aria-labelledby': `wb-ws-tab-${tab}`, className: cx('wb-ws-pane', `is-${tab}`, paneDir > 0 ? 'is-forward' : 'is-back'), role: 'tabpanel' },
            tab === 'overview' ? h(React.Fragment, null,

              h('div', { className: 'wb-ws-overview-grid wb-field-grid' },
                h('div', { className: 'wb-ws-overview-main wb-field-main' },
                  h('section', { className: 'wb-room-command wb-field-next' },
                    h('div', { className: 'wb-room-command-head' },
                      h('span', null, tr('wsTaskEyebrow')),
                      h('b', null, tr('roomNext'))),
                    h('div', { className: 'wb-room-task' },
                      h('div', { className: 'wb-room-task-copy' },
                        h('strong', null, latestSession ? tr('wsContinueTitle') : tr('wsStartTitle')),
                        h('p', null, latestSession ? tr('wsContinueSub', { title: latestSession.title || tr('agentUntitled'), t: relTime(latestSession.updatedAt, tr) }) : tr('wsStartSub'))),
                      h('div', { className: 'wb-room-task-actions' },
                        latestSession
                          ? h('button', { className: 'wb-btn', onClick: () => onOpenSession(latestSession.id, latestSession.source) }, h(Glyph, { name: 'arrow', size: 14 }), tr('wsContinue'))
                          : h('button', { className: 'wb-btn', onClick: focusComposer, disabled: !project.path }, h(Glyph, { name: 'spark', size: 14 }), tr('wsStart')),
                        h('button', { className: 'wb-btn ghost', onClick: focusComposer, disabled: !project.path, title: 'N' }, tr('wsNewTask')))),
                    h('button', {
                      type: 'button', className: cx('wb-room-compose-toggle', taskOpen && 'is-open'),
                      onClick: toggleComposer, 'aria-expanded': taskOpen,
                    }, h(Glyph, { name: 'spark', size: 13 }), taskOpen ? tr('roomComposeClose') : tr('roomComposeOpen')),
                    taskOpen ? h(React.Fragment, null,
                      h('div', { className: 'wb-room-command-row' },
                        h('textarea', {
                          className: 'wb-textarea wb-ws-compose-input', rows: 4, value: taskDraft,
                          placeholder: tr('wsTaskPlaceholder'),
                          onChange: (event) => setTaskDraft(event.target.value),
                          onKeyDown: (event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); startTask() } },
                        }),
                        h('button', { className: 'wb-btn primary', onClick: startTask, disabled: !taskDraft.trim() || !project.path },
                          h(Glyph, { name: 'spark', size: 14 }), tr('wsRun'))),
                      h('div', { className: 'wb-room-command-hint' }, tr('wsComposeHint'))) : null),
                  project.runtime ? h('section', { className: 'wb-ws-section wb-field-runtime' },
                    h('div', { className: 'wb-ws-section-head' }, h('h2', null, h(Glyph, { name: 'timeline', size: 14 }), tr('wsRuntime')), h('span', null, tr('wsRuntimeSub'))),
                    h(WorkspaceRuntime, { runtime: project.runtime, tr })) : null,
                  artifactMedia.length ? h('section', { className: 'wb-ws-section' },
                    h('div', { className: 'wb-ws-section-head' }, h('h2', null, h(Glyph, { name: 'box', size: 14 }), tr('wsLatestOutputs')), h('button', { className: 'wb-link', onClick: () => chooseChapter('outputs') }, tr('wsViewAllOutputs'), h(Glyph, { name: 'arrow', size: 12 }))),
                    h('div', { className: 'wb-ws-art-strip' }, artifactMedia.slice(0, 3).map((artifact, index) => h(WorkspaceArtifact, { key: artifact.id || artifact.path, artifact, tr, featured: index === 0 })))) : null,
                  h('details', { className: 'wb-field-note' },
                    h('summary', null,
                      h('span', { className: 'wb-field-note-title' }, h(Glyph, { name: 'tag', size: 14 }), tr('projectNotes')),
                      h('span', { className: 'wb-field-note-hint' }, tr('noteSavedLocally'))),
                    h('div', { className: 'wb-field-note-body' },
                      h('textarea', { className: 'wb-textarea wb-ws-note', rows: 3, value: note, placeholder: tr('notePlaceholder'), onChange: (event) => setNote(event.target.value), onBlur: () => { if (note !== (project.note || '')) save() } }),
                      h('div', { className: 'wb-ws-note-foot' },
                        h('span', { className: cx(saved && 'wb-note-saved') }, saved ? tr('saved') : tr('saveHint')),
                        h('button', { className: 'wb-btn primary', onClick: save, disabled: saving }, saving ? tr('saving') : tr('save'))))),
                  sessions.length ? h('section', { className: 'wb-ws-section' },
                    h('div', { className: 'wb-ws-section-head' }, h('h2', null, h(Glyph, { name: 'layers', size: 14 }), tr('recentSessions')), h('button', { className: 'wb-link', onClick: () => chooseChapter('sessions') }, tr('wsAllSessions'), h(Glyph, { name: 'arrow', size: 12 }))),
                    h('div', { className: 'wb-ws-session-list' }, sessions.slice(0, 3).map((session) => h(WorkspaceSessionRow, { key: session.id, session, tr, onOpenSession, onForkSession, compact: true })))) : null),
                h('aside', { className: 'wb-ws-side wb-field-aside' },
                  h('div', { className: 'wb-field-aside-head' },
                    h('span', null, 'PROJECT DOSSIER')),
                  h('section', { className: 'wb-ws-side-card wb-room-memory' },
                    h('div', { className: 'wb-ws-side-title' }, tr('roomMemory'), h('span', { className: 'wb-chip accent', style: { marginLeft: 'auto' } }, memoryState ? tr('roomMemoryNative') : tr('roomMemoryEmpty'))),
                    memoryState ? h(React.Fragment, null,
                      h('div', { className: 'wb-room-memory-row' }, h('b', null, memoryUpdated), h('span', null, '·'), h('span', null, `${tr('git')} ${memory?.git?.branch || '—'}${memory?.git?.dirty ? ` · ${tr('gitDirty', { n: memory.git.dirty })}` : ''}`)),
                      h('div', { className: 'wb-room-memory-path', title: memoryPath }, memoryPath),
                      h('div', { className: 'wb-room-memory-actions' },
                        h('button', { className: 'wb-btn ghost', disabled: !memory?.exists, onClick: () => onOpen(memory?.paths?.doc || project.path) }, tr('roomMemoryOpen'))))
                    : h(React.Fragment, null,
                      h('div', { className: 'wb-room-memory-empty' }, tr('roomMemoryHint')),
                      h('div', { className: 'wb-room-memory-actions' },
                        h('button', { className: 'wb-btn ghost', disabled: !project.path, onClick: () => onOpen(project.path) }, tr('openFolder'))))),
                  h('details', { className: 'wb-ws-side-card wb-room-contract' },
                    h('summary', { className: 'wb-ws-side-title' }, tr('contractTitle'), h('span', { className: 'wb-chip', style: { marginLeft: 'auto' } }, memoryState ? tr('contractFromState') : tr('contractNotRecorded'))),
                    h('div', { className: 'wb-contract-body' },
  h('div', { className: 'wb-contract-row' }, h('b', null, tr('contractGoal')), h('span', null, memoryState?.goal || tr('contractNotRecorded'))),
  h('div', { className: 'wb-contract-row' }, h('b', null, tr('contractInput')), h('span', null, memoryState?.files || project.path || tr('contractNotRecorded'))),
  h('div', { className: 'wb-contract-row' }, h('b', null, tr('contractOutput')), h('span', { title: artifacts.slice(0, 2).map((artifact) => artifact.path || artifact.title || '').join(' / ') }, artifacts.length ? artifacts.slice(0, 2).map((artifact) => artifact.title || artifact.path || artifact.kind).join(' · ') : tr('contractNotRecorded'))),
  h('div', { className: 'wb-contract-row' }, h('b', null, tr('contractConstraints')), h('span', null, memoryState?.constraints || tr('contractNotRecorded'))),
  h('div', { className: 'wb-contract-row' }, h('b', null, tr('contractStatus')), h('span', null, statusLabel(status, tr) + (project.runtime?.state ? ' · ' + tr(RUNTIME_STATE_KEYS[project.runtime.state] || 'runtimeUnknown') : '') + ' · ' + statusSourceLabel(project.statusSource, tr))),
                      h('p', { className: 'wb-contract-hint' }, tr('contractHint')))),
                  h('section', { className: 'wb-ws-side-card wb-room-details' },
                    h('div', { className: 'wb-ws-side-title' }, tr('details')),
                    h('div', { className: 'wb-ws-facts' },
                      h('div', null, h('span', null, tr('lastActivity')), h('b', null, `${fmtDate(project.lastActivity)} · ${relTime(project.lastActivity, tr)}`)),
                      h('div', null, h('span', null, tr('created')), h('b', null, fmtDate(project.created))),
                      h('div', null, h('span', null, tr('files')), h('b', null, (project.fileCount || 0).toLocaleString())),
                      h('div', null, h('span', null, tr('childCount')), h('b', null, String(project.childrenCount || 0))),
                      h('div', null, h('span', null, tr('statusSource')), h('b', null, statusSourceLabel(project.statusSource, tr))),
                      h('div', null, h('span', null, tr('sourcesLabel')), h('b', null, (project.sources || []).map((source) => sourceLabel(source, tr)).join(' · ') || '—')))),
                  (parent || children.length) ? h('section', { className: 'wb-ws-side-card wb-room-relations' },
                    h('div', { className: 'wb-ws-side-title' }, tr('wsRelations')),
                    parent ? h('button', { className: 'wb-ws-relation', onClick: () => onSelect(parent) }, h(Glyph, { name: 'arrow', size: 12 }), h('span', null, parent.displayName || parent.name), h('small', null, tr('parentProject'))) : null,
                    children.slice(0, 12).map((child) => h('button', { key: child.id, className: 'wb-ws-relation', onClick: () => onSelect(child) }, h('span', { className: 'wb-dot', style: { background: statusColor(child.status) } }), h('span', null, child.displayName || child.name), h('small', null, fmtBytes(child.sizeBytes))))) : null,
                  project.tags?.length ? h('section', { className: 'wb-ws-side-card wb-room-tags' },
                    h('div', { className: 'wb-ws-side-title' }, tr('tags')),
                    h('div', { className: 'wb-tag-list' }, project.tags.map((tag) => h('span', { className: 'wb-chip accent', key: tag }, tag)))) : null))) : null,
            tab === 'capability' ? h(CapabilityPane, {
              project, sessions, artifacts, memoryState, handoffHistory, projectSkills, skillsScan, tr, onHandoff, notify,
            }) : null,
            tab === 'outputs' ? h('div', { className: 'wb-ws-outputs' },
              h('div', { className: 'wb-ws-pane-head' },
                h('div', null, h('h2', null, tr('wsOutputs')), h('p', null, tr('wsOutputsSub', { n: artifacts.length }))),
                h('button', { className: 'wb-btn', onClick: () => onOpen(project.path) }, h(Glyph, { name: 'folder', size: 14 }), tr('openFolder'))),
              artifacts.length
                ? h('div', { className: 'wb-ws-art-grid' }, artifacts.map((artifact) => h(WorkspaceArtifact, { key: artifact.id || artifact.path, artifact, tr })))
                : h('div', { className: 'wb-ws-empty' }, h(Glyph, { name: 'box', size: 24 }), h('b', null, tr('wsNoOutputs')), h('span', null, tr('wsNoOutputsSub')))) : null,
            tab === 'sessions' ? h('div', { className: 'wb-ws-sessions' },
              h('div', { className: 'wb-ws-pane-head' },
                h('div', null, h('h2', null, tr('wsSessions')), h('p', null, tr('wsSessionsSub', { n: sessions.length }))),
                latestSession ? h('button', { className: 'wb-btn primary', onClick: () => onOpenSession(latestSession.id, latestSession.source) }, tr('wsContinue')) : null),
              sourceWarnings.length ? h('div', { className: 'wb-source-warning' }, sourceWarnings.map(([name, source]) => h('span', { key: name },
                h(Glyph, { name: 'alert', size: 12 }), tr('sessionSourceUnavailable', { source: name, error: source.error || '—' })))) : null,
              h('section', { className: 'wb-lineage-head' },
                h('div', null,
                  h('div', { className: 'wb-lineage-kicker' }, h(Glyph, { name: 'fork', size: 13 }), tr('lineageTitle')),
                  h('p', null, tr('lineageSub'))),
                h('span', { className: cx('wb-chip', lineage.rootConfirmed ? 'is-lineage-main' : 'is-lineage-main-candidate') },
                  lineage.rootConfirmed ? tr('lineageRootConfirmed') : tr('lineageRootCandidate'))),
              sessions.length ? h('div', { className: 'wb-ws-session-list is-full' },
                mainRow ? h('div', { className: 'wb-lineage-group' },
                  h('div', { className: 'wb-lineage-label' }, h('span', null, lineage.rootConfirmed ? tr('lineageMain') : tr('lineageCandidate')), h('b', null, '01')),
                  h(WorkspaceSessionRow, { session: mainRow, tr, onOpenSession, onForkSession, onUnlinkSession: unlinkSession, onSetMain: markMain, onMarkContinuation: markContinuation, onMarkSide: markSide, busy: sessionBusy })) : null,
                continuationRows.length ? h('div', { className: 'wb-lineage-group is-continuation' },
                  h('div', { className: 'wb-lineage-label' }, h('span', null, tr('lineageContinuation')), h('b', null, String(continuationRows.length).padStart(2, '0'))),
                  continuationRows.map((session) => h(WorkspaceSessionRow, { key: session.id, session, tr, onOpenSession, onForkSession, onUnlinkSession: unlinkSession, onSetMain: markMain, onMarkContinuation: markContinuation, onMarkSide: markSide, busy: sessionBusy }))) : null,
                unassignedRows.length ? h('div', { className: 'wb-lineage-group is-unassigned' },
                  h('div', { className: 'wb-lineage-label' }, h('span', null, tr('lineageUnassigned')), h('b', null, String(unassignedRows.length).padStart(2, '0'))),
                  h('p', { className: 'wb-lineage-hint' }, tr('lineageUnassignedHint')),
                  unassignedRows.map((session) => h(WorkspaceSessionRow, { key: session.id, session, tr, onOpenSession, onForkSession, onUnlinkSession: unlinkSession, onSetMain: markMain, onMarkContinuation: markContinuation, onMarkSide: markSide, busy: sessionBusy }))) : null,
                sideRows.length ? h('div', { className: 'wb-lineage-group is-side' },
                  h('div', { className: 'wb-lineage-label' }, h('span', null, tr('lineageSide')), h('b', null, String(sideRows.length).padStart(2, '0'))),
                  sideRows.map((session) => h(WorkspaceSessionRow, { key: session.id, session, tr, onOpenSession, onForkSession, onUnlinkSession: unlinkSession, onSetMain: markMain, onMarkContinuation: markContinuation, onMarkSide: markSide, busy: sessionBusy }))) : null)
                : h('div', { className: 'wb-ws-empty' }, h(Glyph, { name: 'layers', size: 24 }), h('b', null, tr('noSessions')), h('span', null, tr('wsNoSessionsSub'))),
              h('section', { className: 'wb-handoff-history' },
                h('div', { className: 'wb-ws-side-title' }, tr('handoffHistory')),
                h('p', { className: 'wb-handoff-hint' }, tr('handoffHistorySub')),
                handoffHistory.length ? h('div', { className: 'wb-handoff-record-list' }, handoffHistory.slice(0, 8).map((record) => {
                  const statusLabels = {
                    prefilled: tr('handoffStatusPrefilled'), sent: tr('handoffStatusSent'),
                    running: tr('handoffStatusRunning'), completed: tr('handoffStatusCompleted'),
                    failed: tr('handoffStatusFailed'),
                  }
                  return h('div', { className: 'wb-handoff-record', key: record.id },
                    h('div', { className: 'wb-handoff-record-head' },
                      h('span', { className: cx('wb-chip', `is-handoff-${record.status || 'prefilled'}`) }, statusLabels[record.status] || record.status || '—'),
                      h('b', null, record.sourceTitle || (record.sourceKind === 'codex' ? 'Codex' : record.sourceKind === 'dsh' ? 'DSH' : tr('handoffManual'))),
                      h('span', null, fmtDateTime(record.updatedAt || record.createdAt))),
                    h('div', { className: 'wb-handoff-record-meta' },
                      h('span', null, `${record.sourceKind === 'codex' ? 'Codex' : record.sourceKind === 'dsh' ? 'DSH' : tr('handoffManual')} → ${record.targetApp || 'dsh'}`),
                      record.sourceSessionId ? h('code', null, record.sourceSessionId) : null),
                    record.goal ? h('p', { className: 'wb-handoff-record-goal' }, truncate(record.goal, 240)) : null,
                    record.status !== 'completed' && record.status !== 'failed' ? h('div', { className: 'wb-handoff-record-actions' },
                      h('button', { className: 'wb-btn ghost', onClick: () => setHandoffStatus(record.id, 'completed') }, tr('handoffMarkDone')),
                      h('button', { className: 'wb-btn ghost', onClick: () => setHandoffStatus(record.id, 'failed') }, tr('handoffMarkFailed'))) : null)
                })) : h('div', { className: 'wb-note-local' }, tr('handoffHistoryEmpty'))),
              h('section', { className: 'wb-ws-linkbox' },
                h('div', { className: 'wb-ws-side-title' }, tr('sessionLink')),
                candidates.length ? h('div', { className: 'wb-form-row' },
                  h('select', { className: 'wb-select', style: { flex: 1, minWidth: 0 }, value: sessionPick || candidates[0].id, onChange: (event) => setSessionPick(event.target.value) },
                    candidates.map((session) => h('option', { value: session.id, key: `${session.source || 'dsh'}:${session.id}` }, `${session.source === 'codex' ? 'Codex' : 'DSH'} · ${session.title || session.id} · ${wbBaseName(session.cwd) || tr('agentUntitled')}`))),
                  h('button', { className: 'wb-btn', onClick: linkSession, disabled: sessionBusy }, tr('sessionLink'))) : h('div', { className: 'wb-empty' }, tr('sessionNoCandidates')),
                h('div', { className: 'wb-note-local' }, tr('sessionLinkHint')))) : null,
            tab === 'settings' ? h('div', { className: 'wb-ws-settings' },
              h('div', { className: 'wb-ws-pane-head' }, h('div', null, h('h2', null, tr('wsSettings')), h('p', null, tr('wsSettingsSub')))),
              h('section', { className: 'wb-ws-settings-card wb-life-settings' },
                h('div', { className: 'wb-ws-side-title' }, tr('roomLifecycle'),
                  h('span', { className: cx('wb-chip', `is-lineage-${lifecycle}`), style: { marginLeft: 'auto' } }, lifecycleLabel(lifecycle, tr))),
                h('p', { className: 'wb-life-settings-sub' }, tr('roomLifecycleSub')),
                h('div', { className: 'wb-life-choices' }, ['persistent', 'incubating', 'temporary', 'unclassified'].map((value) => h('button', {
                  key: value, type: 'button', className: cx('wb-life-choice', `is-${value}`, lifecycle === value && 'on'),
                  onClick: () => saveLifecycle(value), disabled: lifecycleBusy,
                }, h('i', null), h('span', null, lifecycleLabel(value, tr)), lifecycle === value ? h(Glyph, { name: 'check', size: 11 }) : null))),
                h('label', { className: 'wb-field-label' }, tr('identityIntent')),
                h('textarea', { className: 'wb-textarea', rows: 2, value: intent, placeholder: tr('identityIntentPlaceholder'), onChange: (event) => setIntent(event.target.value) }),
                h('button', { className: 'wb-btn', onClick: () => saveLifecycle(lifecycle), disabled: lifecycleBusy }, lifecycleBusy ? tr('saving') : tr('roomLifecycleSave')),
                h('div', { className: 'wb-life-settings-foot' },
                  h('span', null, `${lifecycleSourceLabel(project.lifecycleSource, tr)} · ${tr('identitySub')}`),
                  project.identity?.manifest ? h('code', null, `${project.path}\\${project.identity.manifest}`) : h('code', null, tr('identityNoManifest')))),
              h('section', { className: 'wb-ws-settings-card' },
                h('div', { className: 'wb-ws-side-title' }, tr('status')),
                h('div', { className: 'wb-status-btns' }, ['active', 'paused', 'archived', 'unknown'].map((value) => h('button', {
                  key: value, className: cx('wb-status-btn', status === value && 'on'), style: { '--sc': statusColor(value) },
                  onClick: () => { setStatus(value); persist({ status: value }) },
                }, h('span', { className: 'wb-dot', style: { background: statusColor(value) } }), statusLabel(value, tr))))),
              h('section', { className: 'wb-ws-settings-card wb-integration-card' },
                h('div', { className: 'wb-ws-side-title' }, tr('integrationTitle'),
                  h('span', { className: cx('wb-chip', `is-integration-${integrationMode}`), style: { marginLeft: 'auto' } }, integrationLevelLabel(integrationMode, tr))),
                h('p', { className: 'wb-integration-sub' }, tr(integrationMode === 'project' ? 'integrationProjectSub'
                  : integrationMode === 'app' ? 'integrationAppSub'
                  : integrationMode === 'unknown' ? 'integrationUnknownSub' : 'integrationIndexSub')),
                integrationMode === 'index' ? null : h('div', { className: 'wb-meta-grid wb-integration-meta' },
                  h(MetaCell, { k: tr('integrationKind'), v: integration.kind }),
                  h(MetaCell, { k: tr('integrationEntry'), v: integration.entry?.value || tr('integrationNoEntry') }),
                  h(MetaCell, { k: tr('integrationAgent'), v: integration.agent || '—' }),
                  h(MetaCell, { k: tr('integrationApply'), v: integration.apply || '—' }),
                  h(MetaCell, { k: tr('integrationState'), v: (integration.state || []).join(' · ') || '—' }),
                  h(MetaCell, { k: tr('integrationManifest'), v: project.identity?.manifest || '—' })),
                integrationMode === 'app' || integrationMode === 'unknown'
                  ? h('p', { className: 'wb-integration-note' }, h(Glyph, { name: 'alert', size: 12 }), tr('integrationNoAdapter'))
                  : null),
              h('section', { className: 'wb-ws-settings-card' },
                h('div', { className: 'wb-ws-side-title' }, tr('tags')),
                h('input', { className: 'wb-input', style: { width: '100%' }, value: tags, placeholder: tr('addTags'), onChange: (event) => setTags(event.target.value), onBlur: () => { if (tags !== (project.tags || []).join(', ')) save() } }),
                h('div', { className: 'wb-tag-list' }, normalizedTags.map((tag) => h('span', { className: 'wb-chip accent', key: tag }, tag))),
                h('div', { className: 'wb-form-row' },
                  h('label', { className: 'wb-check' }, h('input', { type: 'checkbox', checked: pinned, onChange: (event) => { setPinned(event.target.checked); persist({ pinned: event.target.checked }) } }), tr('pin')),
                  h('label', { className: 'wb-check' }, h('input', { type: 'checkbox', checked: hidden, onChange: (event) => { setHidden(event.target.checked); persist({ hidden: event.target.checked }) } }), tr('hide')))),
              h('section', { className: 'wb-ws-settings-card' },
                h('div', { className: 'wb-ws-side-title' }, `${tr('projectFolders')} · ${project.folderCount || (project.path ? 1 : 0)}`),
                h('div', { className: 'wb-sub-list' }, (project.folders || [{ path: project.path, role: 'main', primary: true }]).map((folder) => h('div', { className: 'wb-sub-row', key: folder.path },
                  h('span', { className: 'wb-chip' }, folder.primary ? tr('projectLabel') : tr(`folderRole${folder.role ? folder.role[0].toUpperCase() + folder.role.slice(1) : 'Reference'}`)),
                  h('span', { style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: folder.path }, folder.path),
                  h('button', { className: 'wb-btn ghost icon', title: tr('openFolder'), onClick: () => onOpen(folder.path) }, h(Glyph, { name: 'folder', size: 13 })),
                  folder.primary ? null : h('button', { className: 'wb-btn ghost icon', title: tr('remove'), disabled: folderBusy, onClick: () => removeFolder(folder) }, h(Glyph, { name: 'close', size: 13 }))))),
                h('div', { className: 'wb-form-row', style: { marginTop: '8px' } },
                  h('input', { className: 'wb-input', style: { flex: 1 }, value: folderPath, placeholder: tr('folderPathPlaceholder'), onChange: (event) => setFolderPath(event.target.value), onKeyDown: (event) => { if (event.key === 'Enter') addFolder() } }),
                  h('select', { className: 'wb-select', value: folderRole, onChange: (event) => setFolderRole(event.target.value) },
                    ['code', 'assets', 'output', 'data', 'docs', 'reference'].map((role) => h('option', { value: role, key: role }, tr(`folderRole${role[0].toUpperCase() + role.slice(1)}`)))),
                  h('button', { className: 'wb-btn', onClick: addFolder, disabled: folderBusy || !folderPath.trim() }, tr('addFolder')))),
              (git.branch || git.remote || git.lastCommit) ? h('section', { className: 'wb-ws-settings-card' },
                h('div', { className: 'wb-ws-side-title' }, tr('git')),
                h('div', { className: 'wb-meta-grid' },
                  h(MetaCell, { k: tr('branch'), v: git.branch || '—' }),
                  h(MetaCell, { k: tr('commits'), v: String(git.commits ?? '—') }),
                  h(MetaCell, { k: tr('remote'), v: git.remote || '—' }),
                  h(MetaCell, { k: tr('lastCommit'), v: fmtDate(git.lastCommit) }))) : null,
              h('section', { className: 'wb-ws-settings-card' },
                h('div', { className: 'wb-ws-side-title' }, tr('details')),
                h('div', { className: 'wb-meta-grid' },
                  h(MetaCell, { k: tr('created'), v: fmtDate(project.created) }),
                  h(MetaCell, { k: tr('lastActivity'), v: `${fmtDate(project.lastActivity)} · ${relTime(project.lastActivity, tr)}` }),
                  h(MetaCell, { k: tr('size'), v: fmtBytes(project.sizeBytes) }),
                  h(MetaCell, { k: tr('files'), v: (project.fileCount || 0).toLocaleString() }),
                  h(MetaCell, { k: tr('statusSource'), v: statusSourceLabel(project.statusSource, tr) }),
                  h(MetaCell, { k: tr('childCount'), v: String(project.childrenCount || 0) }),
                  h(MetaCell, { k: tr('sourcesLabel'), v: (project.sources || []).map((source) => sourceLabel(source, tr)).join(' · ') || '—' }),
                  h(MetaCell, { k: tr('toolsLabel'), v: (project.tools || []).join(' · ') || '—' })))) : null),
          h('div', { className: 'wb-ws-footer' },
            h('div', { className: 'wb-ws-footer-info' }, h(Glyph, { name: 'folder', size: 13 }), h('span', { title: project.path }, project.path)),
            h('div', { className: 'wb-ws-footer-actions' },
              h('button', { className: 'wb-btn ghost', onClick: () => { navigator.clipboard?.writeText(project.path); notify?.(tr('copied')) } }, h(Glyph, { name: 'copy', size: 13 }), tr('copyPath')),
              h('button', { className: 'wb-btn ghost', onClick: () => onOpen(project.path) }, h(Glyph, { name: 'external', size: 13 }), tr('openFolder'))))))
    }

    function MetaCell({ k, v }) {
      return h('div', { className: 'wb-meta-cell' },
        h('div', { className: 'wb-meta-key' }, k),
        h('div', { className: 'wb-meta-val' }, v || '—'))
    }

    function useDshSessionList(agentRuntime) {
      const [state, setState] = useState({ snapshot: null, unavailable: false, pending: true })
      useEffect(() => {
        let stopped = false
        let unsubscribe = null
        let timer = null
        let poll = null
        let attempts = 0
        const read = () => {
          try {
            const snapshot = listRef.getSnapshot()
            setState({ snapshot, unavailable: false, pending: snapshot?.phase === 'pending' })
          } catch {
            setState({ snapshot: null, unavailable: true, pending: false })
          }
        }
        let listRef = null
        const attach = () => {
          if (stopped) return
          let service = null
          try { service = agentRuntime?.getSessions?.() } catch { service = null }
          const list = service?.list
          if (!list || typeof list.getSnapshot !== 'function') {
            attempts += 1
            if (attempts >= 20) setState({ snapshot: null, unavailable: true, pending: false })
            else timer = setTimeout(attach, 800)
            return
          }
          listRef = list
          try {
            const snapshot = list.getSnapshot()
            setState({ snapshot, unavailable: false, pending: snapshot?.phase === 'pending' })
          } catch {
            setState({ snapshot: null, unavailable: true, pending: false })
            return
          }
          if (typeof list.subscribe === 'function') {
            try {
              const result = list.subscribe(() => read())
              unsubscribe = typeof result === 'function' ? result : (typeof result?.dispose === 'function' ? () => result.dispose() : null)
            } catch { /* snapshot polling below keeps the list usable */ }
          }
          if (!unsubscribe) poll = setInterval(read, 5000)
        }
        attach()
        return () => {
          stopped = true
          clearTimeout(timer)
          clearInterval(poll)
          if (typeof unsubscribe === 'function') unsubscribe()
        }
      }, [agentRuntime])
      return state
    }

    function SkillAtlas({ tr }) {
      const [data, setData] = useState(null)
      const [loading, setLoading] = useState(true)
      const [error, setError] = useState('')
      const [query, setQuery] = useState('')
      const [originFilter, setOriginFilter] = useState('authored')
      const [sourceFilter, setSourceFilter] = useState('all')
      const [categoryFilter, setCategoryFilter] = useState('all')
      const [scopeFilter, setScopeFilter] = useState('all')
      const [sort, setSort] = useState('source')
      const [selectedId, setSelectedId] = useState('')
      const [detail, setDetail] = useState(null)
      const [detailLoading, setDetailLoading] = useState(false)
      const [note, setNote] = useState('')

      const load = useCallback(async (refresh = false) => {
        setLoading(true); setError('')
        try {
          const response = await fetch(`${API}/skills${refresh ? '?refresh=1' : ''}`, { credentials: 'same-origin' })
          const payload = await response.json()
          if (!response.ok || !payload.ok) throw new Error(payload.error || `HTTP ${response.status}`)
          setData(payload)
        } catch (err) {
          setError(String(err?.message || err))
        } finally { setLoading(false) }
      }, [])

      useEffect(() => { load(false) }, [load])

      useEffect(() => {
        if (!data?.skills?.length) return
        if (selectedId && data.skills.some((skill) => skill.id === selectedId)) return
        const first = data.skills.find((skill) => skill.origin === 'authored') || data.skills[0]
        setSelectedId(first.id)
      }, [data, selectedId])

      useEffect(() => {
        if (!selectedId) { setDetail(null); return }
        let dead = false
        setDetailLoading(true)
        fetch(`${API}/skill?id=${encodeURIComponent(selectedId)}`, { credentials: 'same-origin' })
          .then((response) => response.json())
          .then((payload) => { if (!dead) setDetail(payload.ok ? payload.skill : null) })
          .catch(() => { if (!dead) setDetail(null) })
          .finally(() => { if (!dead) setDetailLoading(false) })
        return () => { dead = true }
      }, [selectedId])

      const skills = data?.skills || []
      const stats = data?.stats || {}
      const origins = [
        ['authored', tr('skillAuthored'), stats.originCounts?.authored || 0],
        ['installed', tr('skillInstalled'), stats.originCounts?.installed || 0],
        ['all', tr('skillAll'), stats.total || 0],
      ]
      const matrixSkills = useMemo(
        () => skills.filter((skill) => originFilter === 'all' || skill.origin === originFilter),
        [skills, originFilter],
      )
      const categories = useMemo(() => {
        const order = ['视频图像', '内容写作', '开发工程', '自动化系统', '办公数据', '研究分析', '其他']
        const present = new Set(matrixSkills.map((skill) => skill.category))
        return order.filter((category) => present.has(category))
      }, [matrixSkills])
      const sources = useMemo(() => {
        const counts = {}
        for (const skill of matrixSkills) counts[skill.source] = (counts[skill.source] || 0) + 1
        return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
      }, [matrixSkills])
      const cellCounts = useMemo(() => {
        const counts = {}
        for (const skill of matrixSkills) {
          const key = `${skill.source}\u0000${skill.category}`
          counts[key] = (counts[key] || 0) + 1
        }
        return counts
      }, [matrixSkills])
      const maxCell = Math.max(1, ...Object.values(cellCounts))
      const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase()
        const rows = skills.filter((skill) => {
          if (originFilter !== 'all' && skill.origin !== originFilter) return false
          if (sourceFilter !== 'all' && skill.source !== sourceFilter) return false
          if (categoryFilter !== 'all' && skill.category !== categoryFilter) return false
          if (scopeFilter !== 'all' && skill.scope !== scopeFilter) return false
          if (!needle) return true
          return [skill.name, skill.description, skill.path, skill.source, skill.category, ...(skill.tags || [])]
            .join(' ').toLowerCase().includes(needle)
        })
        return rows.sort((a, b) => {
          if (sort === 'name') return a.name.localeCompare(b.name, 'zh-CN')
          if (sort === 'recent') return b.mtime - a.mtime
          return a.source.localeCompare(b.source, 'zh-CN') || a.name.localeCompare(b.name, 'zh-CN')
        })
      }, [skills, query, originFilter, sourceFilter, categoryFilter, scopeFilter, sort])

      const openSkillFolder = async () => {
        if (!detail) return
        try {
          const response = await fetch(`${API}/skill-open`, {
            method: 'POST', credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: detail.id }),
          })
          const payload = await response.json()
          if (!response.ok || !payload.ok) throw new Error(payload.error || '打开失败')
        } catch (err) { setNote(String(err?.message || err)) }
      }
      const copyPath = async () => {
        if (!detail) return
        try { await navigator.clipboard?.writeText(detail.path); setNote(tr('skillCopied')) } catch { setNote(detail.path) }
      }
      const selectCell = (source, category) => {
        setSourceFilter(sourceFilter === source ? 'all' : source)
        setCategoryFilter(categoryFilter === category ? 'all' : category)
      }

      if (loading && !data) {
        return h('div', { className: 'wb-sk' },
          h('div', { className: 'wb-sk-head' }, h('div', null, h('div', { className: 'wb-wall-kicker' }, tr('skillKicker')), h('h1', { className: 'wb-sk-title' }, tr('skillTitle')))),
          h('div', { className: 'wb-sk-skeleton' }, tr('skillScanning')))
      }

      return h('section', { className: 'wb-sk' },
        h('div', { className: 'wb-sk-head' },
          h('div', null,
            h('div', { className: 'wb-wall-kicker' }, h('i', { className: 'wb-wall-live-dot' }), tr('skillKicker')),
            h('h1', { className: 'wb-sk-title' }, tr('skillTitle')),
            h('p', { className: 'wb-sk-sub' }, tr('skillSub', { total: stats.total || 0, names: stats.uniqueNames || 0, sources: Object.keys(stats.sourceCounts || {}).length }))),
          h('div', { className: 'wb-sk-head-actions' },
            note ? h('span', { className: 'wb-sk-note' }, note) : null,
            h('button', { className: 'wb-btn', onClick: () => load(true), disabled: loading }, h(Glyph, { name: 'refresh', size: 13 }), loading ? tr('skillScanning') : tr('skillRefresh')))),
        error ? h('div', { className: 'wb-sk-error' }, error) : null,
        h('div', { className: 'wb-sk-switch' },
          origins.map(([id, label, count]) => h('button', {
            key: id, className: cx('wb-sk-pill', originFilter === id && 'on'), onClick: () => setOriginFilter(id),
          }, label, h('b', null, count))),
          h('span', { className: 'wb-sk-scanned' }, tr('skillScannedAt', { t: data?.scannedAt ? relTime(data.scannedAt, tr) : '—' }))),
        h('div', { className: 'wb-sk-layout' },
          h('div', { className: 'wb-sk-main' },
            h('div', { className: 'wb-sk-matrix-head' },
              h('div', null, h('span', { className: 'wb-sk-eyebrow' }, tr('skillMatrix')), h('small', null, tr('skillMatrixHint'))),
              h('div', { className: 'wb-sk-legend' }, h('span', null, tr('skillLow')), h('i', null), h('i', { className: 'mid' }), h('i', { className: 'hot' }), h('span', null, tr('skillHigh')))),
            h('div', { className: 'wb-sk-matrix', style: { gridTemplateColumns: `minmax(116px,1.35fr) repeat(${Math.max(1, categories.length)}, minmax(48px,1fr))` } },
              h('div', { className: 'wb-sk-matrix-corner' }, tr('skillSource')),
              categories.map((category) => h('div', { key: category, className: cx('wb-sk-matrix-cat', categoryFilter === category && 'on') }, category)),
              sources.map(([source, count]) => h(React.Fragment, { key: source },
                h('button', { className: cx('wb-sk-source', sourceFilter === source && 'on'), onClick: () => setSourceFilter(sourceFilter === source ? 'all' : source), title: `${source} · ${count}` },
                  h('span', null, source), h('b', null, count)),
                categories.map((category) => {
                  const value = cellCounts[`${source}\u0000${category}`] || 0
                  const level = value ? Math.max(0.22, Math.min(0.95, value / maxCell)) : 0
                  return h('button', {
                    key: category, className: cx('wb-sk-cell', value && 'has', sourceFilter === source && categoryFilter === category && 'on'),
                    style: value ? { '--wb-sk-alpha': level } : undefined,
                    title: `${source} · ${category} · ${value}`,
                    onClick: () => value && selectCell(source, category),
                  }, value || '')
                }))),
              h('div', { className: 'wb-sk-matrix-corner bottom' }, ''),
              categories.map((category) => h('div', { key: `sum-${category}`, className: 'wb-sk-matrix-sum' },
                matrixSkills.filter((skill) => skill.category === category).length))),
            h('div', { className: 'wb-sk-tools' },
              h('div', { className: 'wb-search wb-sk-search' }, h('span', { className: 'wb-search-icon' }, h(Glyph, { name: 'search', size: 15 })),
                h('input', { className: 'wb-input', placeholder: tr('skillSearch'), value: query, onChange: (event) => setQuery(event.target.value) })),
              h('select', { className: 'wb-select', value: sourceFilter, onChange: (event) => setSourceFilter(event.target.value), title: tr('skillSource') },
                h('option', { value: 'all' }, tr('skillAllSources')),
                sources.map(([source]) => h('option', { key: source, value: source }, source))),
              h('select', { className: 'wb-select', value: categoryFilter, onChange: (event) => setCategoryFilter(event.target.value), title: tr('skillCategory') },
                h('option', { value: 'all' }, tr('skillAllCategories')),
                categories.map((category) => h('option', { key: category, value: category }, category))),
              h('select', { className: 'wb-select', value: scopeFilter, onChange: (event) => setScopeFilter(event.target.value), title: tr('skillScope') },
                h('option', { value: 'all' }, tr('skillAllScopes')),
                [['user', tr('skillScopeUser')], ['project', tr('skillScopeProject')], ['app', tr('skillScopeApp')], ['system', tr('skillScopeSystem')]].map(([id, label]) => h('option', { key: id, value: id }, label))),
              h('select', { className: 'wb-select', value: sort, onChange: (event) => setSort(event.target.value) },
                h('option', { value: 'source' }, tr('skillSortSource')),
                h('option', { value: 'name' }, tr('skillSortName')),
                h('option', { value: 'recent' }, tr('skillSortRecent')))),
            h('div', { className: 'wb-sk-list-head' },
              h('span', null, tr('skillIndex')),
              h('b', null, `${filtered.length} / ${skills.length}`),
              h('span', { className: 'wb-sk-list-hint' }, tr('skillIndexHint'))),
            h('div', { className: 'wb-sk-list', role: 'list' },
              filtered.length ? filtered.map((skill) => h('button', {
                key: skill.id, role: 'listitem', className: cx('wb-sk-row', selectedId === skill.id && 'on'),
                onClick: () => setSelectedId(skill.id),
              },
                h('span', { className: 'wb-sk-row-main' },
                  h('span', { className: 'wb-sk-row-name' }, skill.name,
                    skill.isDuplicate ? h('em', { className: 'wb-sk-dup' }, tr('skillDuplicateCount', { n: skill.duplicateCount })) : null),
                  h('span', { className: 'wb-sk-row-desc' }, skill.description || tr('skillNoDescription'))),
                h('span', { className: 'wb-sk-row-side' },
                  h('span', { className: 'wb-sk-source-tag' }, skill.source),
                  h('span', { className: 'wb-sk-cat-tag' }, skill.category),
                  h('span', { className: 'wb-sk-row-path', title: skill.path }, skill.path))))
                : h('div', { className: 'wb-sk-empty' }, h(Glyph, { name: 'search', size: 22 }), h('b', null, tr('skillNoMatch')), h('span', null, tr('skillNoMatchHint'))))),
          h('aside', { className: 'wb-sk-detail' },
            detailLoading && !detail ? h('div', { className: 'wb-sk-detail-empty' }, tr('skillLoading'))
              : detail ? h(React.Fragment, null,
                h('div', { className: 'wb-sk-detail-top' },
                  h('span', { className: 'wb-sk-source-tag' }, detail.source),
                  h('span', { className: 'wb-sk-cat-tag' }, detail.category),
                  detail.origin === 'installed' ? h('span', { className: 'wb-sk-origin-tag' }, tr('skillInstalled')) : h('span', { className: 'wb-sk-origin-tag authored' }, tr('skillAuthoredTag'))),
                h('h2', { className: 'wb-sk-detail-name' }, detail.name),
                h('p', { className: 'wb-sk-detail-desc' }, detail.description || tr('skillNoDescription')),
                h('div', { className: 'wb-sk-detail-actions' },
                  h('button', { className: 'wb-btn primary', onClick: openSkillFolder }, h(Glyph, { name: 'folder', size: 13 }), tr('skillOpen')),
                  h('button', { className: 'wb-btn ghost', onClick: copyPath }, h(Glyph, { name: 'copy', size: 13 }), tr('skillCopy'))),
                h('div', { className: 'wb-sk-meta' },
                  h('div', null, h('span', null, tr('skillPath')), h('code', null, detail.path)),
                  h('div', null, h('span', null, tr('skillScope')), h('b', null, tr(`skillScope${detail.scope[0].toUpperCase()}${detail.scope.slice(1)}`))),
                  h('div', null, h('span', null, tr('skillUpdated')), h('b', null, relTime(detail.mtime, tr))),
                  h('div', null, h('span', null, tr('skillSize')), h('b', null, fmtBytes(detail.size || 0)))),
                detail.tags?.length ? h('div', { className: 'wb-sk-tags' }, detail.tags.map((tag) => h('span', { key: tag }, tag))) : null,
                h('div', { className: 'wb-sk-preview-head' }, tr('skillPreview')),
                h('pre', { className: 'wb-sk-preview' }, (detail.content || '').slice(0, 14000) || tr('skillNoContent')),
                detail.duplicatePaths?.length ? h('div', { className: 'wb-sk-dups' },
                  h('div', { className: 'wb-sk-preview-head' }, tr('skillDuplicatesTitle')),
                  detail.duplicatePaths.map((peer) => h('button', { key: peer.id, className: 'wb-sk-dup-row', onClick: () => setSelectedId(peer.id) },
                    h('span', null, peer.source), h('code', { title: peer.path }, peer.path)))) : null)
              : h('div', { className: 'wb-sk-detail-empty' }, h(Glyph, { name: 'spark', size: 24 }), h('b', null, tr('skillDetailEmpty')), h('span', null, tr('skillDetailEmptyHint')))))) 
    }

    function WorkbenchPage({ t, agentRuntime }) {
      const tr = useMemo(() => makeT(t), [t])
      const sessionState = useDshSessionList(agentRuntime)
      const liveTitles = useMemo(() => {
        const byId = sessionState.snapshot?.byId || {}
        const map = {}
        for (const [id, record] of Object.entries(byId)) {
          const title = record?.title || record?.displayTitle
          if (title) map[id] = String(title)
        }
        return map
      }, [sessionState.snapshot])
      const [data, setData] = useState(null)
      const [loading, setLoading] = useState(true)
      const [error, setError] = useState('')
      const [tab, setTab] = useState('projects')
      const [query, setQuery] = useState('')
      const [statusFilter, setStatusFilter] = useState('all')
      const [sourceFilter, setSourceFilter] = useState('all')
      const [workspaceFilter, setWorkspaceFilter] = useState('all')
      const [sort, setSort] = useState('recent')
      const [scenePreferences, setScenePreferences] = useState(() => readScenePreferences(sceneStorage()))
      const [sceneStorageError, setSceneStorageError] = useState(false)
      const [view, setView] = useState(() => scenePreferences.start)
      const [earthActiveId, setEarthActiveId] = useState('')
      const [libraryQuery, setLibraryQuery] = useState('')
      const [libraryShelf, setLibraryShelf] = useState('all')
      const [timeQuery, setTimeQuery] = useState('')
      const [timeBucket, setTimeBucket] = useState('all')
      const [studioQuery, setStudioQuery] = useState('')
      const [studioRoom, setStudioRoom] = useState('overview')
      const [studioCamera, setStudioCamera] = useState({ x: 0, y: 0, z: 1 })
      const [showHidden, setShowHidden] = useState(false)
      const [showNoise, setShowNoise] = useState(false)
      const [followOnly, setFollowOnly] = useState(false)
      const [selected, setSelected] = useState(null)
      const [route, setRoute] = useState({ name: 'index', projectId: null, tab: 'overview' })
      const routeRef = useRef(route)
      const exitGuardRef = useRef(null)
      const skipGuardPopRef = useRef(false)
      const projectSwitchRef = useRef(false)
      const historySnapshotRef = useRef(null)
      const popControllerRef = useRef(null)
      const applyPopRef = useRef(null)
      const trRef = useRef(tr)
      trRef.current = tr
      const previousRouteRef = useRef(route.name)
      const originRef = useRef(null)
      const returnRef = useRef(history.state?.wbWallReturn
        ? { scrollTop: Number(history.state.wbWallReturn.scrollTop) || 0, projectId: history.state.wbWallReturn.projectId || '' }
        : { scrollTop: 0, projectId: '' })
      const restoreRef = useRef(null)
      useEffect(() => {
        try {
          if (!history.state?.wbAtlasHistory) {
            history.replaceState({ ...(history.state || {}), wbAtlasHistory: { session: `${Date.now()}-${Math.random()}`, index: 0 } }, '')
          }
          historySnapshotRef.current = { state: history.state, url: location.href }
        } catch { /* history support is optional */ }
      }, [])
      const [handoff, setHandoff] = useState(null)
      const [handoffLoading, setHandoffLoading] = useState(false)
      const [selectionMode, setSelectionMode] = useState(false)
      const [selectedIds, setSelectedIds] = useState([])
      const [deleteOpen, setDeleteOpen] = useState(false)
      const [deleting, setDeleting] = useState(false)
      const [deleteError, setDeleteError] = useState('')
      const [toast, setToast] = useState('')
      const toastTimer = useRef(null)
      const mainRef = useRef(null)
      useEffect(() => { routeRef.current = route }, [route])
      useEffect(() => {
        const previousRoute = previousRouteRef.current
        previousRouteRef.current = route.name
        if (route.name === 'index' && previousRoute === 'index' && mainRef.current) mainRef.current.scrollTop = 0
      }, [tab, view, route.name])
      useEffect(() => {
        if (route.name !== 'index') return
        setHandoff(null)
        setHandoffLoading(false)
      }, [route.name])
      const notify = useCallback((msg) => {
        setToast(msg)
        clearTimeout(toastTimer.current)
        toastTimer.current = setTimeout(() => setToast(''), 2600)
      }, [])

      const load = useCallback(async (silent) => {
        if (!silent) setLoading(true)
        try {
          const r = await fetch(`${API}/state`, { cache: 'no-store' })
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          const j = await r.json()
          setData(j); setError('')
          // DSH session metadata can still be warming up on the first request
          // after a plugin reload. Refresh once quietly instead of leaving the
          // session KPI at zero until the user presses refresh.
          if (!silent && (j.projects || []).length && j.stats?.sessionCount === 0) {
            setTimeout(() => load(true), 1500)
          }
          return true
        } catch (e) {
          setError(tr('apiError') + ': ' + e.message)
          return false
        } finally { if (!silent) setLoading(false) }
      }, [tr])

      useEffect(() => { load() }, [load])
      useEffect(() => {
        if (!data?.scanning) return
        const id = setInterval(() => load(true), 2500)
        return () => clearInterval(id)
      }, [data?.scanning, load])

      useEffect(() => {
        if (!selected) return
        const fresh = (data?.projects || []).find((p) => p.id === selected.id)
        if (fresh && fresh !== selected) setSelected(fresh)
      }, [data, selected])

      useEffect(() => {
        if (tab === 'projects') return
        setSelectionMode(false)
        setSelectedIds([])
        setDeleteOpen(false)
        setDeleteError('')
      }, [tab])

      const rescan = useCallback(async () => {
        try {
          const r = await fetch(`${API}/rescan`, { method: 'POST' })
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          notify(tr('scanStarted'))
          setData((d) => d ? { ...d, scanning: true } : d)
        } catch (e) { notify(tr('scanFailed') + ': ' + e.message) }
      }, [tr, notify])

      const saveProject = useCallback(async (id, patch) => {
        try {
          const r = await fetch(`${API}/override`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, patch }) })
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          const j = await r.json()
          const notePatch = patch && Object.prototype.hasOwnProperty.call(patch, 'note') ? { note: String(patch.note || '') } : null
          const projectView = notePatch ? { ...j.project, ...notePatch } : j.project
          setData((d) => d ? { ...d, projects: d.projects.map((p) => p.id === id ? { ...p, ...projectView } : p) } : d)
          setSelected((s) => s && s.id === id ? { ...s, ...projectView } : s)
          // Notes are workbench-local annotations. Never mirror them into the
          // project directory; opening an AI session is the only handoff path.
          return { ok: true, localOnly: true }
        } catch (e) { notify(tr('saveFailed') + ': ' + e.message); return { ok: false, error: e.message } }
      }, [tr, notify])

      const saveProjectIdentity = useCallback(async (id, patch) => {
        try {
          // Lifecycle, intent and session lineage are workbench-local metadata.
          // They deliberately do not touch the project directory.
          const r = await fetch(`${API}/override`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id, patch }),
          })
          const j = await r.json().catch(() => ({}))
          if (!r.ok || j.ok === false) return { ok: false, error: j.error || `HTTP ${r.status}` }
          await load(true)
          return { ok: true, ...j }
        } catch (e) { return { ok: false, error: e.message } }
      }, [load])
      const openPath = useCallback(async (p) => {
        try {
          const r = await fetch(`${API}/open`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: p }) })
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
        } catch (e) { notify(tr('openFailed') + ': ' + e.message) }
      }, [tr, notify])

      const linkFolder = useCallback(async (id, folderPath, role) => {
        const r = await fetch(`${API}/project-folders`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, path: folderPath, role }) })
        const j = await r.json().catch(() => ({}))
        if (!r.ok || j.ok === false) return { ok: false, error: j.error || `HTTP ${r.status}` }
        setSelected((s) => {
          if (!s || s.id !== id) return s
          const main = (s.folders || []).find((f) => f.primary) || { path: s.path, role: 'main', primary: true }
          return { ...s, folders: [main, ...(j.folders || [])], folderCount: 1 + (j.folders || []).length }
        })
        return { ok: true }
      }, [])

      const unlinkFolder = useCallback(async (id, folderPath) => {
        const r = await fetch(`${API}/project-folders`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, path: folderPath }) })
        const j = await r.json().catch(() => ({}))
        if (!r.ok || j.ok === false) return { ok: false, error: j.error || `HTTP ${r.status}` }
        setSelected((s) => {
          if (!s || s.id !== id) return s
          const main = (s.folders || []).find((f) => f.primary) || { path: s.path, role: 'main', primary: true }
          return { ...s, folders: [main, ...(j.folders || [])], folderCount: 1 + (j.folders || []).length }
        })
        return { ok: true }
      }, [])

      const linkSession = useCallback(async (id, sessionId, source = 'dsh') => {
        const r = await fetch(`${API}/project-sessions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, sessionId, source }) })
        const j = await r.json().catch(() => ({}))
        if (!r.ok || j.ok === false) return { ok: false, error: j.error || `HTTP ${r.status}` }
        await load(true)
        return { ok: true }
      }, [load])

      const unlinkSession = useCallback(async (id, sessionId, source = 'dsh') => {
        const r = await fetch(`${API}/project-sessions`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, sessionId, source }) })
        const j = await r.json().catch(() => ({}))
        if (!r.ok || j.ok === false) return { ok: false, error: j.error || `HTTP ${r.status}` }
        await load(true)
        return { ok: true }
      }, [load])

      const markFollowup = useCallback(async (id, state = 'done') => {
        try {
          const response = await fetch(`${API}/followup`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id, state }),
          })
          const json = await response.json().catch(() => ({}))
          if (!response.ok || json.ok === false) throw new Error(json.error || `HTTP ${response.status}`)
          await load(true)
          if (state === 'done') notify(tr('followupMarked'))
          return { ok: true }
        } catch (error) {
          notify(`${tr('followupFailed')}：${error?.message || error}`)
          return { ok: false, error: error?.message || String(error) }
        }
      }, [load, notify, tr])

      const openSession = useCallback(async (id, source = 'dsh') => {
        if (source === 'codex') {
          try {
            const response = await fetch(`${API}/codex-session-open`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ id }),
            })
            const result = await response.json().catch(() => ({}))
            if (!response.ok || result.ok === false) throw new Error(result.error || `HTTP ${response.status}`)
            notify(tr('agentOpened'))
          } catch (error) {
            notify(`${tr('agentOpenSessionFailed')} ${error?.message || error}`)
          }
          return
        }
        try {
          const ui = agentRuntime?.getUiWorkspace?.()
          if (!ui || typeof ui.openSession !== 'function') throw new Error(tr('agentOpenSessionFailed'))
          ui.openSession(id)
          notify(tr('agentOpened'))
        } catch (error) {
          notify(`${tr('agentOpenSessionFailed')} ${error?.message || error}`)
        }
      }, [agentRuntime, notify, tr])

      const forkSession = useCallback(async (id) => {
        const ui = agentRuntime?.getUiWorkspace?.()
        if (!ui || typeof ui.forkSession !== 'function' || typeof ui.openSession !== 'function') {
          notify(tr('sessionForkUnavailable'))
          return
        }
        try {
          const childId = await ui.forkSession(id)
          if (childId) ui.openSession(childId)
          notify(tr('sessionForkDone'))
        } catch (error) {
          notify(`${tr('handoffForkFailed')} ${error?.message || ''}`.trim())
        }
      }, [agentRuntime, notify, tr])

      const openProjectHandoff = useCallback(async (project, options = {}) => {
        if (!project?.path) {
          notify(tr('handoffNoPath'))
          return
        }
        if (handoffLoading) return
        try {
          const response = await fetch(`${API}/path-status`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ path: project.path }),
          })
          if (response.ok) {
            const status = await response.json()
            if (status?.ok && (!status.exists || !status.isDirectory)) {
              notify(tr('handoffNoPath'))
              return
            }
          }
        } catch { /* The workspace creation below still reports the real error. */ }
        let handoffDoc = ''
        let handoffDocMtime = ''
        let truthDocs = []
        let truthDocsStatus = 'not-read'
        try {
          const response = await fetch(`${API}/project-handoff?projectId=${encodeURIComponent(project.id)}`, { cache: 'no-store' })
          const result = await response.json().catch(() => ({}))
          if (response.ok && result.ok !== false) {
            handoffDoc = String(result.doc || '')
            handoffDocMtime = String(result.docMtime || '')
            truthDocs = Array.isArray(result.truthDocs) ? result.truthDocs : []
            truthDocsStatus = String(result.truthDocsStatus || (truthDocs.length ? 'read' : 'none'))
          }
        } catch { /* the handoff still opens from the session digest */ }
        if (options.mode === 'new') {
          setHandoff({ kind: 'project', project, session: null, digest: null, presetGoal: options.goal || '', mode: 'new', handoffDoc, handoffDocMtime, truthDocs, truthDocsStatus })
          return
        }
        const linked = (project.sessions || []).slice().sort((a, b) => (Date.parse(b.updatedAt || '') || 0) - (Date.parse(a.updatedAt || '') || 0))[0]
        const latest = linked
          ? { ...linked, cwd: linked.cwd || project.path, source: linked.source || 'dsh' }
          : findLatestSessionForProject(agentRuntime, project.path)
        if (!latest) {
          setHandoff({ kind: 'project', project, session: null, digest: null, presetGoal: options.goal || '', mode: options.mode || 'new', handoffDoc, handoffDocMtime, truthDocs, truthDocsStatus })
          return
        }
        setHandoffLoading(true)
        notify(tr('handoffSourceLoading'))
        try {
          const digest = await fetchDigestForSession(latest)
          setHandoff({ kind: 'project', project, session: latest, digest, presetGoal: options.goal || '', mode: options.mode || 'continue', handoffDoc, handoffDocMtime, truthDocs, truthDocsStatus })
        } catch (error) {
          setHandoff({
            kind: 'project',
            project,
            session: latest,
            digest: null,
            presetGoal: options.goal || '',
            mode: options.mode || 'continue',
            handoffDoc,
            handoffDocMtime,
            truthDocs,
            truthDocsStatus,
            error: `${tr('handoffSourceFailed')} ${error?.message || ''}`.trim(),
          })
        } finally {
          setHandoffLoading(false)
        }
      }, [agentRuntime, handoffLoading, notify, tr])

      const recordHandoff = useCallback(async (prompt, source, values) => {
        const projectPath = values?.projectPath || source?.project?.path || source?.session?.cwd || ''
        if (!projectPath && !source?.project?.id) return
        try {
          const response = await fetch(`${API}/handoffs`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              projectId: source?.project?.id || '',
              projectPath,
              sourceKind: source?.session?.source === 'codex' ? 'codex' : source?.session ? 'dsh' : 'manual',
              sourceSessionId: source?.session?.id || '',
              sourceTitle: source?.session?.title || '',
              sourceUpdatedAt: source?.session?.updatedAt || '',
              goal: values?.goal || '',
              progress: values?.progress || '',
              constraints: values?.constraints || '',
              files: values?.files || '',
              summary: values?.summary || '',
              targetApp: values?.targetApp || 'dsh',
              targetSessionId: values?.targetSessionId || '',
              mode: values?.mode || '',
              // Opening or prefilling is not delivery. Only a target that
              // actually accepts and sends the handoff may be recorded as sent.
              status: ['prompt-only', 'native-new-session', 'existing-session'].includes(values?.mode) || !values?.mode ? 'prefilled' : 'sent',
              prompt,
              projectDoc: values?.projectDoc || '',
            }),
          })
          const result = await response.json().catch(() => ({}))
          return result?.handoff || null
        } catch { /* Handoff records are best-effort; never block the handoff UI. */ return null }
      }, [])

      const persistProjectHandoff = useCallback(async (prompt, source, values) => {
        const project = source?.project || (data?.projects || []).find((item) => sameLocalPath(item.path, source?.session?.cwd))
        if (!project?.id || !project.path) return { ok: false, error: tr('handoffPersistNoProject') }
        try {
          const response = await fetch(`${API}/project-handoff`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              projectId: project.id,
              projectName: project.displayName || project.name,
              cwd: project.path,
              targetApp: values?.targetApp || 'dsh',
              goal: values?.goal || '',
              progress: values?.progress || '',
              constraints: values?.constraints || '',
              summary: values?.summary || '',
              sourceSessionId: source?.session?.id || '',
              prompt,
              writeProject: values?.persistProject === true,
              writeAgents: values?.persistProject === true && values?.persistAgents === true,
            }),
          })
          const result = await response.json().catch(() => ({}))
          if (!response.ok || result.ok === false) throw new Error(result.error || `HTTP ${response.status}`)
          window.dispatchEvent(new CustomEvent('wb-handoff-saved', { detail: { projectId: project.id } }))
          return { ok: true, ...result }
        } catch (error) {
          return { ok: false, error: `${tr('handoffPersistFailed')}：${error?.message || error}` }
        }
      }, [data, tr])

      const startHandoff = useCallback(async (prompt, source, options = {}, values = null) => {
        const targetApp = options.targetApp || values?.targetApp || 'dsh'
        const projectPath = source?.project?.path || source?.session?.cwd || ''
        if (!projectPath) return { ok: false, error: tr('handoffNoPath') }
        let persisted = null
        if (values?.persistProject === true) {
          persisted = await persistProjectHandoff(prompt, source, { ...values, targetApp })
          if (persisted.ok === false) return persisted
        }

        const targetSession = options.targetSession
        if (targetSession?.id) {
          const copied = await copyText(prompt)
          if (!copied) return { ok: false, error: tr('handoffCopyFailed') }
          await openSession(targetSession.id, targetSession.source || 'dsh')
          recordHandoff(prompt, source, {
            ...(values || {}), projectDoc: persisted?.docPath || '',
            targetApp: targetSession.source || 'dsh',
            targetSessionId: targetSession.id,
            mode: 'existing-session',
          })
          notify(tr('handoffExistingOpened'))
          return { ok: true }
        }

        if (targetApp !== 'dsh') {
          const projectId = source?.project?.id || ''
          if (!projectId) return { ok: false, error: tr('handoffNoProject') }
          const copied = await copyText(prompt)
          if (!copied) return { ok: false, error: tr('handoffCopyFailed') }
          try {
            const response = await fetch(`${API}/inherit`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                projectId,
                projectName: source?.project?.displayName || source?.project?.name || '',
                targetApp,
                cwd: projectPath,
                prompt,
              }),
            })
            const result = await response.json().catch(() => ({}))
            if (!response.ok || result.ok === false) throw new Error(result.error || `HTTP ${response.status}`)
            if (result.mode === 'prompt-only') {
              recordHandoff(prompt, source, { ...(values || {}), projectDoc: persisted?.docPath || '', targetApp, mode: result.mode, targetSessionId: result.targetSessionId || '' })
              notify(tr('inheritOpenDone'))
            } else {
              recordHandoff(prompt, source, { ...(values || {}), projectDoc: persisted?.docPath || '', targetApp, mode: result.mode, targetSessionId: result.targetSessionId || '' })
              notify(tr('inheritOpenCodeDone'))
            }
            return { ok: true }
          } catch (error) {
            return { ok: false, error: `${tr('inheritFailed')}：${error?.message || error}` }
          }
        }

        let ui = null
        let workspaceService = null
        try { ui = agentRuntime?.getUiWorkspace?.() } catch { ui = null }
        try { workspaceService = agentRuntime?.getWorkspaces?.() } catch { workspaceService = null }
        if (!ui || typeof ui.startSession !== 'function' || !workspaceService || typeof workspaceService.create !== 'function') {
          return { ok: false, error: tr('handoffUnavailable') }
        }
        try {
          const workspace = await workspaceService.create({ path: projectPath })
          if (!workspace?.workspaceId) return { ok: false, error: tr('handoffUnavailable') }
          const snapshot = agentRuntime?.getSessions?.()?.list?.getSnapshot?.()
          const sessionIds = Array.isArray(workspace.sessionIds) ? workspace.sessionIds : []
          const hasBlank = sessionIds.some((id) => snapshot?.byId?.[id]?.blank === true)
          const unknownDraft = !snapshot && sessionIds.length > 0
          if ((hasBlank || unknownDraft) && !options.force) return { needsConfirm: true }
          ui.startSession(workspace.workspaceId, {
            prompt,
            clearPreviousDraft: true,
            whenDraftExists: 'replace',
          })
          recordHandoff(prompt, source, { ...(values || {}), projectDoc: persisted?.docPath || '', targetApp: 'dsh', mode: 'native-new-session' })
          notify(tr('handoffOpened'))
          return { ok: true }
        } catch (error) {
          return { ok: false, error: error?.message || String(error) }
        }
      }, [agentRuntime, notify, openSession, persistProjectHandoff, recordHandoff, tr])

      const all = useMemo(() => (data?.projects || []).map((project) => ({
        ...project,
        sessions: (project.sessions || []).map((session) => ({
          ...session,
          title: session.title || liveTitles[session.id] || '',
        })),
      })), [data, liveTitles])
      const allSessions = useMemo(() => (data?.sessions || []).map((session) => ({
        ...session,
        title: session.title || liveTitles[session.id] || '',
      })), [data, liveTitles])
      const top = useMemo(() => all.filter((p) => p.topLevel && !p.hidden && !p.noise), [all])
      const workspaces = useMemo(() => [...new Set(top.map((p) => p.workspace).filter(Boolean))].sort(), [top])
      const filtered = useMemo(() => {
        let list = all.filter((p) => (showHidden || !p.hidden) && (showNoise || !p.noise) && p.topLevel)
        if (followOnly) list = list.filter((p) => p.needsFollowup)
        if (query.trim()) {
          const q = query.trim().toLowerCase()
          list = list.filter((p) => `${p.displayName} ${p.name} ${p.path} ${p.note || ''} ${p.summary || ''} ${(p.tags || []).join(' ')}`.toLowerCase().includes(q))
        }
        if (statusFilter !== 'all') list = list.filter((p) => p.status === statusFilter)
        if (sourceFilter !== 'all') list = list.filter((p) => (p.sources || []).includes(sourceFilter))
        if (workspaceFilter !== 'all') list = list.filter((p) => (p.workspace || '') === workspaceFilter)
        const by = sort === 'size' ? (a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0)
          : sort === 'name' ? (a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'zh-CN')
          : sort === 'created' ? (a, b) => new Date(b.created || 0) - new Date(a.created || 0)
          : (a, b) => new Date(b.lastActivity || 0) - new Date(a.lastActivity || 0)
        list = [...list].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || by(a, b))
        return list
      }, [all, showHidden, showNoise, followOnly, query, statusFilter, sourceFilter, workspaceFilter, sort])
      const displayed = useMemo(() => filtered.filter((p) => statusFilter === 'archived' || p.status !== 'archived'), [filtered, statusFilter])

      useEffect(() => {
        const main = mainRef.current
        if (!main) return undefined
        const remember = (event) => {
          const target = event.target instanceof Element ? event.target.closest('[data-project-id]') : null
          originRef.current = target || null
        }
        main.addEventListener('pointerdown', remember, true)
        return () => main.removeEventListener('pointerdown', remember, true)
      }, [])

      const finishCloseProject = useCallback(() => {
        const previous = returnRef.current
        if (history.state?.dshWorkbench) {
          try { history.replaceState({ ...(history.state || {}), dshWorkbench: null }, '') } catch { /* history is optional */ }
        }
        const commit = () => {
          setSelected(null)
          setRoute({ name: 'index', projectId: null, tab: 'overview' })
          routeRef.current = { name: 'index', projectId: null, tab: 'overview' }
        }
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
        const clearMorph = clearProjectMorph
        if (!reduce && typeof document.startViewTransition === 'function') {
          try {
            const transition = document.startViewTransition(() => new Promise((resolve) => {
              commit()
              setTimeout(() => {
                const target = previous?.projectId
                  ? (document.querySelector(`.wb-deck-row[data-project-id="${previous.projectId}"]`)
                    || document.querySelector(`.wb-deck-stage[data-project-id="${previous.projectId}"]`)
                    || document.querySelector(`[data-project-id="${previous.projectId}"]`))
                  : null
                if (target) markProjectMorph(target)
                resolve()
              }, 40)
            }))
            transition.finished.finally(clearMorph)
          } catch { commit(); clearMorph() }
        } else commit()
        restoreRef.current = previous
      }, [])
      const closeProject = useCallback(() => {
        if (history.state?.dshWorkbench?.entry === 'wall') {
          try { skipGuardPopRef.current = true; history.back(); return } catch { skipGuardPopRef.current = false }
        }
        finishCloseProject()
      }, [finishCloseProject])
      const selectWorkspaceTab = useCallback((tab) => {
        const current = routeRef.current
        if (current.name !== 'project') return
        const next = { ...current, tab }
        setRoute(next)
        routeRef.current = next
        if (history.state?.dshWorkbench) {
          try {
            history.replaceState({ ...history.state, dshWorkbench: { ...history.state.dshWorkbench, tab } }, '')
            historySnapshotRef.current = { state: history.state, url: location.href }
          } catch { /* history is optional */ }
        }
      }, [])
      const openProject = useCallback((project, tab = 'overview') => {
        if (!project) return
        const current = routeRef.current
        if (current.name === 'index') {
          returnRef.current = { scrollTop: mainRef.current?.scrollTop || 0, projectId: project.id }
          restoreRef.current = null
          setEarthActiveId(project.id)
        }
        const next = { name: 'project', projectId: project.id, tab: ['overview','capability','outputs','sessions','settings'].includes(tab) ? tab : 'overview' }
        const remembered = originRef.current
        originRef.current = null
        const focused = document.activeElement?.closest?.('[data-project-id]')
        const source = current.name === 'index'
          ? (remembered && document.contains(remembered) && remembered.dataset.projectId === project.id ? remembered
            : focused && document.contains(focused) && focused.dataset.projectId === project.id ? focused
            : [...document.querySelectorAll(`[data-project-id="${project.id}"]`)].find((node) => {
              const rect = node.getBoundingClientRect()
              return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth
            }))
          : null
        if (source) markProjectMorph(source)
        const clearSource = clearProjectMorph
        try {
          if (current.name === 'index') {
            history.replaceState({ ...(history.state || {}), wbWallReturn: { ...returnRef.current } }, '')
          }
          const state = projectHistoryState(history.state, next, current)
          const replace = current.name === 'project' && current.projectId === project.id
          const marker = history.state?.wbAtlasHistory
          if (marker && Number.isInteger(marker.index)) state.wbAtlasHistory = { ...marker, index: marker.index + (replace ? 0 : 1) }
          if (replace) history.replaceState(state, '')
          else history.pushState(state, '')
          historySnapshotRef.current = { state: history.state, url: location.href }
        } catch { /* local navigation still works without History API */ }
        const commit = () => {
          setSelected(project)
          setRoute(next)
          routeRef.current = next
          if (mainRef.current) mainRef.current.scrollTop = 0
        }
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
        if (!reduce && typeof document.startViewTransition === 'function') {
          try {
            const transition = document.startViewTransition(() => new Promise((resolve) => {
              commit()
              setTimeout(resolve, 40)
            }))
            transition.finished.finally(clearSource)
          } catch { commit(); clearSource() }
        } else { commit(); clearSource() }
      }, [])
      const openRelatedProject = useCallback((project, tab = 'overview') => {
        if (!project || project.id === routeRef.current.projectId) { openProject(project, tab); return }
        void guardProjectSwitch(projectSwitchRef, exitGuardRef.current, () => window.confirm(tr('wsLeaveConfirm')), () => openProject(project, tab))
      }, [openProject, tr])
      useEffect(() => {
        applyPopRef.current = (entryState) => {
          historySnapshotRef.current = { state: entryState, url: location.href }
          const state = entryState?.dshWorkbench
          if (!state?.projectId) {
            const wallReturn = entryState?.wbWallReturn
            if (wallReturn) {
              returnRef.current = wallReturn
              restoreRef.current = wallReturn
            }
            finishCloseProject()
            return
          }
          const project = all.find((p) => p.id === state.projectId)
          if (!project) return
          setSelected(project)
          const next = { name: 'project', projectId: project.id, tab: state.tab || 'overview' }
          setRoute(next)
          routeRef.current = next
        }
        if (!popControllerRef.current) popControllerRef.current = createProjectPopGuard({
          history,
          getCurrent: () => ({ route: routeRef.current, ...historySnapshotRef.current }),
          getGuard: () => exitGuardRef.current,
          confirm: () => window.confirm(trRef.current('wsLeaveConfirm')),
          apply: (state) => applyPopRef.current?.(state),
        })
        const fn = (event) => {
          if (skipGuardPopRef.current) { skipGuardPopRef.current = false; applyPopRef.current?.(event.state); return }
          void popControllerRef.current(event.state)
        }
        window.addEventListener('popstate', fn)
        return () => window.removeEventListener('popstate', fn)
      }, [all, finishCloseProject])
      useEffect(() => {
        if (!data || routeRef.current.name !== 'index') return
        const state = history.state?.dshWorkbench
        if (!state?.projectId) return
        const project = all.find((p) => p.id === state.projectId)
        if (!project) return
        const next = { name: 'project', projectId: project.id, tab: state.tab || 'overview' }
        setSelected(project); setRoute(next); routeRef.current = next
      }, [data, all])
      useEffect(() => {
        if (route.name !== 'index' || !restoreRef.current) return
        const pending = restoreRef.current
        restoreRef.current = null
        const restore = () => {
          if (mainRef.current) mainRef.current.scrollTop = pending.scrollTop || 0
          const row = pending.projectId ? mainRef.current?.querySelector(`.wb-deck-row[data-project-id="${pending.projectId}"]`) : null
          const target = row || (pending.projectId ? mainRef.current?.querySelector(`[data-project-id="${pending.projectId}"]`) : null)
          target?.focus?.({ preventScroll: true })
          document.querySelectorAll('[data-project-id]').forEach((node) => { node.style.viewTransitionName = '' })
        }
        requestAnimationFrame(() => requestAnimationFrame(restore))
      }, [route.name])

      const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
      const selectedItems = useMemo(() => all.filter((p) => selectedSet.has(p.id)), [all, selectedSet])
      const selectedBytes = selectedItems.reduce((sum, p) => sum + (p.sizeBytes || 0), 0)
      const archivedVisible = useMemo(() => filtered.filter((p) => p.topLevel && p.status === 'archived' && p.deletable !== false), [filtered])

      const toggleSelection = useCallback((p) => {
        if (!p.topLevel || p.status !== 'archived' || p.deletable === false) return
        setSelectedIds((prev) => {
          if (prev.includes(p.id)) return prev.filter((id) => id !== p.id)
          if (prev.length >= 50) { notify(tr('deleteMax')); return prev }
          return [...prev, p.id]
        })
      }, [notify, tr])

      const selectAllArchived = useCallback(() => {
        if (archivedVisible.length > 50) notify(tr('deleteMax'))
        setSelectedIds(archivedVisible.slice(0, 50).map((p) => p.id))
      }, [archivedVisible, notify, tr])

      const openDelete = useCallback(() => {
        if (!selectedItems.length) { notify(tr('deleteNoSelection')); return }
        setDeleteError('')
        setDeleteOpen(true)
      }, [selectedItems.length, notify, tr])

      const deleteSelectedProjects = useCallback(async (mode) => {
        if (!selectedItems.length) return
        setDeleting(true)
        setDeleteError('')
        try {
          const r = await fetch(`${API}/delete`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              mode,
              acknowledge: mode === 'permanent',
              confirm: mode === 'permanent' ? 'PERMANENT_DELETE' : 'MOVE_TO_RECYCLE_BIN',
              items: selectedItems.map((p) => ({ id: p.id, confirmed: true })),
            }),
          })
          const j = await r.json().catch(() => ({}))
          if (!r.ok) {
            const detail = (j.results || []).map((x) => `${x.id}: ${x.error}`).join('；')
            const base = (r.status === 404 || r.status === 405)
              ? tr('deleteHostMissing')
              : (j.error || `HTTP ${r.status}`)
            setDeleteError(`${base}${detail ? ` — ${detail}` : ''}`)
            notify(tr('deleteFailed'))
            return
          }
          const results = j.results || []
          const okIds = new Set(results.filter((x) => x.ok).map((x) => x.id))
          const failed = results.filter((x) => !x.ok)
          if (okIds.size) {
            setData((d) => d ? { ...d, projects: d.projects.filter((p) => !okIds.has(p.id)) } : d)
            setSelectedIds((prev) => prev.filter((id) => !okIds.has(id)))
          }
          if (failed.length) {
            setDeleteError(tr('deletePartial', { ok: okIds.size, fail: failed.length }) + ' — '
              + failed.slice(0, 3).map((x) => `${x.name || x.id}: ${x.error || ''}`).join('；'))
            notify(tr('deletePartial', { ok: okIds.size, fail: failed.length }))
          } else {
            setDeleteOpen(false)
            setSelectionMode(false)
            notify(mode === 'permanent'
              ? tr('deleteDonePermanent', { n: okIds.size })
              : tr('deleteDoneRecycle', { n: okIds.size }))
          }
          await load(true)
        } catch (e) {
          setDeleteError(tr('deleteFailed') + ': ' + e.message)
          notify(tr('deleteFailed'))
        } finally {
          setDeleting(false)
        }
      }, [selectedItems, notify, tr, load])

      const stats = data?.stats || {}
      const followup = data?.followup || {}
      const recent = useMemo(() => [...top].filter((p) => p.status !== 'archived').sort((a, b) => new Date(b.lastActivity || 0) - new Date(a.lastActivity || 0)).slice(0, 6), [top])
      const cleanup = useMemo(() => [...top].filter((p) => p.status === 'archived' && p.deletable !== false).sort((a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0)).slice(0, 6), [top])
      const focus = useMemo(() => [...top].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(b.lastActivity || 0) - new Date(a.lastActivity || 0)).slice(0, 4), [top])

      const activeScene = findScene(view)
      const sceneMode = sceneModeFor(route, tab, activeScene)
      const visibleScenes = scenePreferences.order.filter((id) => !scenePreferences.hidden.includes(id)).map((id) => findScene(id)).filter(Boolean)
      const updateScenePreferences = (value) => {
        const next = normalizeScenePreferences(value)
        setScenePreferences(next)
        setSceneStorageError(!writeScenePreferences(sceneStorage(), next))
        if (findScene(view) && next.hidden.includes(view)) setView(next.start)
      }
      const goScene = (next) => {
        if (!canNavigateToView(next)) return
        if (next !== view) {
          if (mainRef.current) mainRef.current.scrollTop = 0
          setView(next)
        }
        setTab('projects')
        requestAnimationFrame(() => {
          if (mainRef.current) mainRef.current.scrollTop = 0
        })
      }

      const goCleanup = () => {
        setQuery('')
        setSourceFilter('all')
        setWorkspaceFilter('all')
        setStatusFilter('archived')
        setFollowOnly(false)
        setSelectedIds([])
        setSelectionMode(true)
        setView('table')
        setTab('projects')
      }

      if (loading && !data) return h('div', { className: 'wb-root' }, h('style', null, CSS), h('div', { className: 'wb-shell' }, h('div', { className: 'wb-skeleton' }), h('div', { className: 'wb-skeleton' }), h('div', { className: 'wb-skeleton' })))

      const scanning = Boolean(data?.scanning)
      return h('div', { className: cx('wb-root', sceneMode && 'is-scene-mode', route.name === 'index' && activeScene && `is-${activeScene.id}-scene`) },
        h('style', null, CSS),
        route.name === 'index' ? h('header', { className: cx('wb-header', tab === 'projects' && 'has-modebar') },
          h('div', { className: 'wb-header-inner' },
            h('div', { className: 'wb-brand' },
              h('div', { className: 'wb-brand-mark' }, h(WorkbenchGlyph, { size: 21 })),
              h('div', { style: { minWidth: 0 } },
                h('div', { className: 'wb-title' }, tr('title'), h('span', { className: 'wb-version' }, 'v1.2.0')),
                h('div', { className: 'wb-subtitle' }, tr('subtitle')))),
            h('div', { className: 'wb-header-spacer' }),
            h('div', { className: 'wb-scan-state' },
              h('span', { className: cx('wb-dot', scanning && 'scan') }),
              h('span', null, scanning ? tr('rescanning') : tr('ready')),
              data?.generatedAt ? h('span', null, `· ${tr('lastScan')} ${relTime(data.generatedAt, tr)}`) : null),
            h('button', { className: 'wb-btn', onClick: () => load(), disabled: scanning },
              h(Glyph, { name: 'refresh', size: 14 }), tr('refresh')),
            h('button', { className: 'wb-btn primary', onClick: rescan, disabled: scanning },
              h(Glyph, { name: 'spark', size: 14 }), scanning ? tr('rescanning') : tr('rescan'))),
          tab === 'projects' ? h('div', { className: 'wb-modebar' },
            h('div', { className: 'wb-modebar-inner' },
              h('span', { className: 'wb-modebar-kicker' }, tr('earthSceneSwitch')),
              h(SceneSwitch, { current: sceneMode ? view : '', onScene: goScene, tr, variant: 'dock', scenes: visibleScenes }),
              h(SceneSettings, { value: scenePreferences, onChange: updateScenePreferences, tr, storageError: sceneStorageError }))) : null) : null,
        h('div', { className: 'wb-main', ref: mainRef },
          route.name === 'project' && selected ? h(ProjectWorkspace, {
            key: selected.id,
            project: all.find((p) => p.id === selected.id) || selected, projects: all, allSessions, sessionSources: data.sessionSources, scene: view, tr, onClose: closeProject,
            onSave: saveProject, onOpen: openPath, onSelect: openRelatedProject, onHandoff: openProjectHandoff, initialTab: route.tab || 'overview', onTabChange: selectWorkspaceTab,
            onLinkFolder: linkFolder, onUnlinkFolder: unlinkFolder, onOpenSession: openSession, onForkSession: forkSession,
            onLinkSession: linkSession, onUnlinkSession: unlinkSession, onMarkFollowup: markFollowup,
            onSetLifecycle: saveProjectIdentity, onSetSessionPolicy: saveProjectIdentity, notify, exitGuardRef,
          }) : h('div', { className: 'wb-shell' },
            error ? h('div', { className: 'wb-error' }, h(Glyph, { name: 'alert', size: 15 }), error, h('button', { className: 'wb-btn ghost', onClick: () => load() }, tr('retry'))) : null,
            data && !data.ready ? h('div', { className: 'wb-panel', style: { padding: '40px 20px' } },
              h('div', { className: 'wb-empty' },
                h('div', { className: 'wb-empty-icon' }, h(Glyph, { name: 'layers', size: 20 })),
                h('div', { className: 'wb-empty-title' }, tr('noData')),
                h('div', { className: 'wb-empty-sub' }, data.needsConfig ? tr('noRootsHint') : tr('scanHint')),
                data.needsConfig ? null : h('button', { className: 'wb-btn primary', style: { marginTop: '14px' }, onClick: rescan }, h(Glyph, { name: 'spark', size: 14 }), tr('scanNow')))) : null,
            data?.ready ? h(React.Fragment, null,
              view !== 'board' || tab !== 'projects' ? h(React.Fragment, null,
                h('div', { className: 'wb-summary' },
                  h('span', { className: 'wb-summary-item' }, h('b', null, top.filter((p) => p.status !== 'archived').length), tr('projectCountLabel')),
                  h('span', { className: 'wb-summary-item' }, h('b', null, stats.active || 0), tr('active')),
                  h('span', { className: cx('wb-summary-item', followup.pending && 'is-alert') }, h('b', null, followup.pending || 0), tr('followupPending')),
                  h('span', { className: 'wb-summary-item' }, h('b', null, stats.sessionCount || 0), tr('sessions')),
                  h('span', { className: 'wb-summary-item' }, h('b', null, fmtBytes(stats.totalBytes || 0)), tr('totalSize')),
                  h('span', { className: 'wb-summary-spacer' })),
                followup.pending ? h('div', { className: 'wb-followup-bar' },
                  h(Glyph, { name: 'flag', size: 17 }),
                  h('div', { className: 'wb-followup-bar-text' },
                    h('span', { className: 'wb-followup-bar-title' }, tr('followupBanner', { n: followup.pending })),
                    tr('followupBannerHint')),
                  h('button', {
                    className: 'wb-btn primary',
                    onClick: () => { setTab('projects'); setFollowOnly(true); setStatusFilter('all'); setSourceFilter('all'); setWorkspaceFilter('all'); setQuery('') },
                  }, tr('followupView'))) : null) : null,
              h('nav', { className: 'wb-tabs' },
                [['projects', 'library', tr('library')], ['skills', 'spark', tr('skills')], ['software', 'software', tr('software')], ['disks', 'disk', tr('disks')]].map(([id, icon, label]) =>
                  h('button', { key: id, className: cx('wb-tab', tab === id && 'active'), onClick: () => { setTab(id); if (mainRef.current) mainRef.current.scrollTop = 0 } }, h(Glyph, { name: icon, size: 15 }), label))),
              tab === 'projects' ? h('div', { className: cx('wb-project-page', sceneMode && 'is-scene') },
                h('div', { className: 'wb-tools' },
                  h('div', { className: 'wb-search' }, h('span', { className: 'wb-search-icon' }, h(Glyph, { name: 'search', size: 15 })), h('input', { className: 'wb-input', placeholder: tr('searchProjects'), value: query, onChange: (e) => setQuery(e.target.value) })),
                  h('select', { className: 'wb-select', value: statusFilter, onChange: (e) => setStatusFilter(e.target.value) },
                    h('option', { value: 'all' }, tr('allStatus')),
                    ['active', 'paused', 'archived', 'unknown'].map((s) => h('option', { value: s, key: s }, statusLabel(s, tr)))),
                  h('select', { className: 'wb-select', value: sourceFilter, onChange: (e) => setSourceFilter(e.target.value) },
                    h('option', { value: 'all' }, tr('allSources')),
                    ['codes', 'dsh', 'opencode'].map((s) => h('option', { value: s, key: s }, sourceLabel(s, tr)))),
                  h('select', { className: 'wb-select', value: sort, onChange: (e) => setSort(e.target.value) },
                    h('option', { value: 'recent' }, tr('sortRecent')),
                    h('option', { value: 'size' }, tr('sortSize')),
                    h('option', { value: 'name' }, tr('sortName')),
                    h('option', { value: 'created' }, tr('sortCreated'))),
                  h('div', { className: 'wb-seg' },
                    activeScene ? null : h('button', { onClick: () => setView('earth') }, h(Glyph, { name: 'globe', size: 13 }), tr('earthTitle')),
                    activeScene ? null : h('button', { onClick: () => setView('library') }, h(Glyph, { name: 'library', size: 13 }), tr('libraryScene')),
                    h('button', { className: cx(view === 'board' && 'on'), onClick: () => setView('board') }, h(Glyph, { name: 'grid', size: 13 }), tr('boardView')),
                    h('button', { className: cx(view === 'cards' && 'on'), onClick: () => setView('cards') }, h(Glyph, { name: 'layers', size: 13 }), tr('cards')),
                    h('button', { className: cx(view === 'table' && 'on'), onClick: () => setView('table') }, h(Glyph, { name: 'list', size: 13 }), tr('table'))),
                  h('button', {
                    className: cx('wb-btn', selectionMode ? 'primary' : 'ghost'),
                    title: tr('selectHint'),
                    onClick: () => {
                      if (selectionMode) { setSelectionMode(false); setSelectedIds([]) }
                      else { setSelectionMode(true); setView('table') }
                    },
                  }, h(Glyph, { name: 'check', size: 13 }), selectionMode ? tr('selectExit') : tr('select'))),
                h('div', { className: 'wb-tools sub' },
                  h('div', { className: 'wb-check-group' },
                    h('label', { className: 'wb-check' }, h('input', { type: 'checkbox', checked: showHidden, onChange: (e) => setShowHidden(e.target.checked) }), tr('showHidden')),
                    h('label', { className: 'wb-check' }, h('input', { type: 'checkbox', checked: showNoise, onChange: (e) => setShowNoise(e.target.checked) }), tr('showNoise')),
                    h('label', { className: 'wb-check' }, h('input', { type: 'checkbox', checked: followOnly, onChange: (e) => setFollowOnly(e.target.checked) }), `${tr('followupFilter')}${followup.pending ? ` · ${followup.pending}` : ''}`)),
                  h('span', { className: 'wb-panel-sub' }, `${tr('showing')} ${displayed.length} ${tr('of')} ${all.filter((p) => p.topLevel && !p.noise && !p.container).length} ${tr('projects')} · ${tr('libraryHint')}`),
                  h('div', { style: { flex: 1 } }),
                  (query || statusFilter !== 'all' || sourceFilter !== 'all' || workspaceFilter !== 'all' || followOnly) ? h('button', { className: 'wb-btn ghost', onClick: () => { setQuery(''); setStatusFilter('all'); setSourceFilter('all'); setWorkspaceFilter('all'); setFollowOnly(false) } }, tr('resetFilters')) : null),
                selectionMode ? h('div', { className: 'wb-batchbar' },
                  h('span', { className: 'wb-batchbar-meta', role: 'status', 'aria-live': 'polite' },
                    selectedIds.length ? tr('selectedSummary', { n: selectedIds.length, size: fmtBytes(selectedBytes) }) : tr('selectPrompt')),
                  h('span', { className: 'wb-batchbar-hint' }, tr('batchHint')),
                  statusFilter !== 'archived' ? h('button', {
                    className: 'wb-btn',
                    style: { padding: '5px 9px' },
                    onClick: () => setStatusFilter('archived'),
                  }, tr('onlyArchived')) : null,
                  h('div', { className: 'wb-batchbar-actions' },
                    h('button', { className: 'wb-btn ghost', onClick: selectAllArchived, disabled: !archivedVisible.length }, tr('selectAllArchived')),
                    h('button', { className: 'wb-btn ghost', onClick: () => setSelectedIds([]), disabled: !selectedIds.length }, tr('clearSelection')),
                    h('button', { className: 'wb-btn danger', onClick: openDelete, disabled: !selectedIds.length },
                      h(Glyph, { name: 'trash', size: 14 }), tr('batchRecycle')))) : null,
                displayed.length ? (selectionMode || view === 'table'
                  ? h(ProjectTable, {
                      projects: displayed, tr, onSelect: openProject, selectionMode,
                      selectedIds: selectedSet, onToggle: toggleSelection,
                    })
                  : activeScene
                    ? renderScene(activeScene, {
                        common: {
                          projects: displayed, activeId: earthActiveId, tr,
                          onActive: setEarthActiveId, onOpen: openProject, onOpenPath: openPath,
                          onRefresh: () => load(true), onScene: goScene,
                        },
                        studio: { query: studioQuery, setQuery: setStudioQuery, roomId: studioRoom, setRoomId: setStudioRoom, camera: studioCamera, setCamera: setStudioCamera },
                        library: { query: libraryQuery, setQuery: setLibraryQuery, shelf: libraryShelf, setShelf: setLibraryShelf },
                        time: { query: timeQuery, setQuery: setTimeQuery, bucket: timeBucket, setBucket: setTimeBucket },
                      })
                  : view === 'board'
                    ? h(ProjectBoard, {
                        projects: displayed, tr, onSelect: openProject,
                        onFollowup: () => { setFollowOnly(true); setStatusFilter('all'); setSourceFilter('all'); setWorkspaceFilter('all'); setQuery('') },
                        onShowAll: () => { setView('table'); setFollowOnly(false); setStatusFilter('all'); setSourceFilter('all'); setWorkspaceFilter('all'); setQuery('') },
                      })
                    : h('div', { className: 'wb-grid' }, displayed.map((p) => h(ProjectCard, {
                        key: p.id, p, tr, onSelect: openProject, selectionMode,
                        selected: selectedSet.has(p.id), onToggle: toggleSelection,
                      }))))
                  : h('div', { className: 'wb-panel' }, h('div', { className: 'wb-empty' },
                    h('div', { className: 'wb-empty-icon' }, h(Glyph, { name: 'search', size: 19 })),
                    h('div', { className: 'wb-empty-title' }, tr(followOnly ? 'followupNone' : 'empty')),
                    h('div', { className: 'wb-empty-sub' }, tr(followOnly ? 'followupScanHint' : 'libraryHint', { t: data.generatedAt ? relTime(data.generatedAt, tr) : '—' }))))) : null,
              tab === 'skills' ? h(SkillAtlas, { tr }) : null,
              tab === 'software' ? h(SoftwareView, { software: data.software || [], tr, onOpen: openPath }) : null,
              tab === 'disks' ? h(DiskView, { data, tr, onOpen: openProject, onCleanup: goCleanup }) : null,
              h('div', { className: 'wb-footer' },
                h('span', null, `${tr('generated')} ${data.generatedAt ? fmtDate(data.generatedAt) : '—'}`),
                h('span', null, `· ${tr('scanTook')} ${data.scanMs ? (data.scanMs / 1000).toFixed(1) + 's' : '—'}`),
                data.warnings?.length ? h('span', null, `· ${tr('warnings')} ${data.warnings.length}`) : null,
                h('span', { style: { flex: 1 } }),
                h('button', { className: 'wb-btn ghost', style: { fontSize: '10px', padding: '4px 6px' }, onClick: async () => {
                  try { await fetch(`${API}/open-data`, { method: 'POST' }) } catch {}
                } }, h(Glyph, { name: 'folder', size: 12 }), tr('dataDir')),
                h('code', null, data.dataDir || '—'))) : null)),
        handoff ? h(HandoffDialog, {
          source: handoff,
          tr,
          notify,
          onClose: () => setHandoff(null),
          onStart: startHandoff,
          onRecord: recordHandoff,
          onPersist: persistProjectHandoff,
        }) : null,
        deleteOpen ? h(DeleteDialog, {
          items: selectedItems,
          tr,
          onClose: () => { if (!deleting) setDeleteOpen(false) },
          onConfirm: deleteSelectedProjects,
          busy: deleting,
          error: deleteError,
        }) : null,
        toast ? h('div', { className: 'wb-toast' }, toast) : null)
    }

    if (typeof window !== 'undefined' && window.__DSH_WORKBENCH_TEST__) {
      window.__DSH_WORKBENCH_TEST__.handoff = {
        buildHandoffValues,
        buildHandoffPrompt,
        filterHandoffCorrections,
        DICT,
      }
      window.__DSH_WORKBENCH_TEST__.scenes = {
        registry: SCENE_REGISTRY,
        findScene,
        sceneModeFor,
        sceneBackLabel,
        renderScene,
        SceneSwitch,
        workspaceOriginLabel,
        WorkspaceOriginMark,
        canNavigateToView,
        projectHistoryState,
        workspaceSaveSnapshot,
        workspaceSaveIsCurrent,
        attemptWorkspaceLeave,
        savePendingWorkspaceChanges,
        guardProjectSwitch,
        handleWorkspaceEscape,
        createProjectPopGuard,
        SceneSettings,
        normalizeScenePreferences,
        readScenePreferences,
        writeScenePreferences,
        studioRooms,
        studioDeskLayout,
        STUDIO_ROOM_CAPACITY,
        libraryPage,
        libraryShelf,
        LIBRARY_PAGE_SIZE,
      }
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, DICT), 'dsh-workbench: locale dictionaries')
        const t = ctx.locale.bind(NS)
        const agentRuntime = {
          getSessions: () => {
            try { return ctx.get('sessions') } catch { return null }
          },
          getUiWorkspace: () => {
            try { return ctx.get('uiWorkspace') } catch { return null }
          },
          getWorkspaces: () => {
            try { return ctx.get('workspaces') } catch { return null }
          },
        }
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: 'dsh-workbench',
          order: 2,
          label: () => t('nav'),
          locale: NS,
          inject: () => ({ t }),
        }, WorkbenchGlyph))
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: 'dsh-workbench',
          locale: NS,
          inject: () => ({ t, agentRuntime }),
        }, WorkbenchPage))
      },
    }
  },
})




