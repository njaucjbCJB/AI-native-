import Form from '@rjsf/core'
import type { RJSFSchema } from '@rjsf/utils'
import validator from '@rjsf/validator-ajv8'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Card, CardContent, CardHeader } from './components/ui/card'
import { deployBlueprint } from './core/blueprint-deployment'
import {
  generateProjectAuditBlueprint,
  type ProjectAuditBlueprint,
} from './core/project-audit-blueprint'
import type { LocalStorageAdapter } from './core/storage'

const DEFAULT_DESCRIPTION = [
  '我们需要周期性开展项目审计，检查项目里程碑、战略目标和预算执行情况。',
  '项目负责人填写并自审批，随后由分管项目 VP 审批，最后由 AI CEO 审批。',
  '审批人需要查看项目快照、当前申报值和完整字段变更记录。',
].join('')

type PreviewSection =
  | 'form'
  | 'entities'
  | 'roles'
  | 'permissions'
  | 'workflow'
  | 'changes'

const PREVIEW_SECTIONS: Array<{ id: PreviewSection; label: string }> = [
  { id: 'form', label: '动态表单' },
  { id: 'entities', label: '实体模型' },
  { id: 'roles', label: '角色' },
  { id: 'permissions', label: '权限' },
  { id: 'workflow', label: '审批流程' },
  { id: 'changes', label: '变更审计' },
]

export function ProjectAuditBlueprintConsole({
  storage,
}: {
  storage: LocalStorageAdapter
}) {
  const [description, setDescription] = useState(DEFAULT_DESCRIPTION)
  const [draft, setDraft] = useState<ProjectAuditBlueprint | null>(null)
  const [versions, setVersions] = useState<ProjectAuditBlueprint[]>([])
  const [selectedBlueprint, setSelectedBlueprint] =
    useState<ProjectAuditBlueprint | null>(null)
  const [activeVersion, setActiveVersion] = useState<ProjectAuditBlueprint | null>(
    null,
  )
  const [activeSection, setActiveSection] = useState<PreviewSection>('form')
  const [message, setMessage] = useState('输入业务描述后生成 Blueprint V2 草稿。')

  const refreshVersions = useCallback(async (preferred?: ProjectAuditBlueprint) => {
    const [storedVersions, currentVersion] = await Promise.all([
      storage.getBlueprintVersions('project-audit'),
      storage.getActiveBlueprintVersion(),
    ])

    setVersions(storedVersions)
    setActiveVersion(currentVersion)
    setSelectedBlueprint(preferred ?? currentVersion ?? storedVersions.at(-1) ?? null)
  }, [storage])

  useEffect(() => {
    let cancelled = false

    void Promise.all([
      storage.getBlueprintVersions('project-audit'),
      storage.getActiveBlueprintVersion(),
    ]).then(([storedVersions, currentVersion]) => {
      if (cancelled) {
        return
      }

      setVersions(storedVersions)
      setActiveVersion(currentVersion)
      setSelectedBlueprint(currentVersion ?? storedVersions.at(-1) ?? null)
    })

    return () => {
      cancelled = true
    }
  }, [storage])

  function handleGenerate() {
    const result = generateProjectAuditBlueprint(description)

    if (result.status === 'unsupported') {
      setDraft(null)
      setSelectedBlueprint(null)
      setMessage(result.message)
      return
    }

    setDraft(result.blueprint)
    setSelectedBlueprint(result.blueprint)
    setMessage('Blueprint V2 草稿已生成，可以预览并部署。')
  }

  async function handleDeploy() {
    if (!draft) {
      setMessage('请先生成 Blueprint 草稿。')
      return
    }

    const deployed = await deployBlueprint(draft, storage)

    setDraft(null)
    await refreshVersions(deployed)
    setMessage(`项目审计 Blueprint v${deployed.version} 已部署并设为当前版本。`)
  }

  const preview = selectedBlueprint ?? draft

  return (
    <div className="blueprint-console">
      <Card className="blueprint-composer">
        <CardHeader>
          <div>
            <p className="eyebrow">Deterministic generator</p>
            <h2>从业务描述生成项目审计蓝图</h2>
          </div>
          <Badge>Blueprint V2</Badge>
        </CardHeader>
        <CardContent>
          <label className="description-field">
            <span>业务描述</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <div className="composer-actions">
            <Button type="button" onClick={handleGenerate}>
              生成草稿
            </Button>
            <Button
              disabled={!draft}
              type="button"
              variant="outline"
              onClick={() => void handleDeploy()}
            >
              部署为新版本
            </Button>
          </div>
          <p className="blueprint-message">{message}</p>
        </CardContent>
      </Card>

      <Card className="version-card">
        <CardHeader>
          <div>
            <p className="eyebrow">Immutable versions</p>
            <h2>部署版本</h2>
          </div>
          <Badge>{versions.length} 个版本</Badge>
        </CardHeader>
        <CardContent>
          <div className="version-list">
            {versions.length ? (
              versions
                .slice()
                .reverse()
                .map((version) => (
                  <Button
                    className={
                      selectedBlueprint?.version === version.version ? 'active' : ''
                    }
                    key={`${version.id}-${version.version}`}
                    type="button"
                    variant="ghost"
                    onClick={() => setSelectedBlueprint(version)}
                  >
                    <span>v{version.version}</span>
                    {activeVersion?.version === version.version ? (
                      <Badge>当前</Badge>
                    ) : null}
                  </Button>
                ))
            ) : (
              <p className="empty-state">尚未部署版本。</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="blueprint-preview">
        <CardHeader>
          <div>
            <p className="eyebrow">Configuration preview</p>
            <h2>{preview?.metadata.name ?? '等待生成蓝图'}</h2>
          </div>
          {preview ? (
            <Badge>
              {preview.lifecycle === 'draft' ? '草稿' : `已部署 v${preview.version}`}
            </Badge>
          ) : null}
        </CardHeader>
        <CardContent>
          {preview ? (
            <>
              <div className="preview-tabs" role="tablist">
                {PREVIEW_SECTIONS.map((section) => (
                  <Button
                    className={activeSection === section.id ? 'active' : ''}
                    key={section.id}
                    type="button"
                    variant="ghost"
                    onClick={() => setActiveSection(section.id)}
                  >
                    {section.label}
                  </Button>
                ))}
              </div>
              <BlueprintPreview blueprint={preview} section={activeSection} />
            </>
          ) : (
            <p className="empty-state">
              生成草稿后，这里会显示实体、动态表单、角色权限、审批流程和变更规则。
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function BlueprintPreview({
  blueprint,
  section,
}: {
  blueprint: ProjectAuditBlueprint
  section: PreviewSection
}) {
  if (section === 'form') {
    return (
      <div className="rjsf-preview">
        <p className="section-note">
          以下表单由 Blueprint JSON Schema 动态渲染；点击底部按钮可执行 AJV
          必填和类型校验。
        </p>
        <Form
          schema={blueprint.formSchema as RJSFSchema}
          validator={validator}
          onSubmit={() => undefined}
        />
      </div>
    )
  }

  if (section === 'entities') {
    return (
      <div className="preview-grid">
        {blueprint.entities.map((entity) => (
          <article key={entity.id}>
            <div className="preview-title">
              <strong>{entity.name}</strong>
              <Badge>{entity.id}</Badge>
            </div>
            <dl>
              {entity.fields.map((field) => (
                <div key={field.id}>
                  <dt>{field.name}</dt>
                  <dd>
                    {field.id} · {field.type}
                  </dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    )
  }

  if (section === 'roles') {
    return (
      <div className="preview-grid compact">
        {blueprint.roles.map((role) => (
          <article key={role.id}>
            <strong>{role.name}</strong>
            <span>{role.id}</span>
          </article>
        ))}
      </div>
    )
  }

  if (section === 'permissions') {
    return (
      <div className="permission-preview">
        <h3>实例可见范围</h3>
        <div className="preview-grid compact">
          {blueprint.visibilityRules.map((rule) => (
            <article key={rule.roleId}>
              <strong>{rule.roleId}</strong>
              <span>
                {rule.scope} · {rule.access}
              </span>
            </article>
          ))}
        </div>
        <h3>字段访问规则</h3>
        <div className="preview-grid compact">
          {blueprint.fieldAccessRules.map((rule, index) => (
            <article key={`${rule.roleId}-${index}`}>
              <strong>
                {rule.roleId} · {rule.access}
              </strong>
              <span>{rule.states.join(', ')}</span>
              <span>{rule.fields.join(', ')}</span>
            </article>
          ))}
        </div>
      </div>
    )
  }

  if (section === 'workflow') {
    return (
      <ol className="audit-workflow">
        {blueprint.workflow.states.map((state) => (
          <li key={state.id}>
            <div>
              <strong>{state.name}</strong>
              <span>{state.roleId ?? state.type}</span>
            </div>
            <p>
              {state.transitions.length
                ? state.transitions
                    .map(
                      (transition) =>
                        `${transition.action} → ${transition.target}${
                          transition.commentRequired ? '（意见必填）' : ''
                        }`,
                    )
                    .join(' / ')
                : '流程终态'}
            </p>
          </li>
        ))}
      </ol>
    )
  }

  return (
    <div className="change-rules">
      <div>
        <span>记录模式</span>
        <strong>{blueprint.changeAuditRules.appendOnly ? '仅追加，不可覆盖' : '-'}</strong>
      </div>
      <h3>修改时必须填写原因的字段</h3>
      <ul>
        {blueprint.changeAuditRules.reasonRequiredFields.map((field) => (
          <li key={field}>{field}</li>
        ))}
      </ul>
    </div>
  )
}
