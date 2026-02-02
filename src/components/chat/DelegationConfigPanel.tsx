import { useState, useCallback } from 'react'
import { Settings2, Cpu } from 'lucide-react'
import { RiGeminiFill } from 'react-icons/ri'
import { SiOpenai, SiClaude } from 'react-icons/si'
import { Kimi } from '@/components/icons/Kimi'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AiCliProvider } from '@/types/preferences'
import { getModelOptionsForProvider } from '@/types/preferences'

interface DelegationConfigPanelProps {
  enabled: boolean
  defaultProvider: AiCliProvider
  defaultModel: string
  onEnabledChange: (enabled: boolean) => void
  onDefaultProviderChange: (provider: AiCliProvider) => void
  onDefaultModelChange: (model: string) => void
}

/** Get provider icon */
function ProviderIcon({ provider, className }: { provider: AiCliProvider; className?: string }) {
  switch (provider) {
    case 'claude':
      return <SiClaude className={className} />
    case 'gemini':
      return <RiGeminiFill className={className} />
    case 'codex':
      return <SiOpenai className={className} />
    case 'kimi':
      return <Kimi className={className} />
    default:
      return <SiClaude className={className} />
  }
}

export function DelegationConfigPanel({
  enabled,
  defaultProvider,
  defaultModel,
  onEnabledChange,
  onDefaultProviderChange,
  onDefaultModelChange,
}: DelegationConfigPanelProps) {
  const [open, setOpen] = useState(false)

  const handleProviderChange = useCallback(
    (value: string) => {
      const provider = value as AiCliProvider
      onDefaultProviderChange(provider)
      // Reset model to first available for new provider
      const models = getModelOptionsForProvider(provider)
      const firstModel = models[0]
      if (firstModel) {
        onDefaultModelChange(firstModel.value)
      }
    },
    [onDefaultProviderChange, onDefaultModelChange]
  )

  const modelOptions = getModelOptionsForProvider(defaultProvider)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted rounded-sm"
        >
          <Settings2 className="h-4 w-4" />
          <span>Delegation Settings</span>
          {enabled && (
            <span className="ml-auto text-xs text-green-500">On</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="delegation-enabled" className="text-sm font-medium">
                Multi-Model Delegation
              </Label>
            </div>
            <Switch
              id="delegation-enabled"
              checked={enabled}
              onCheckedChange={onEnabledChange}
            />
          </div>

          {enabled && (
            <>
              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground mb-3">
                  When approving a plan, you can assign different tasks to different AI providers.
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Default Provider</Label>
                  <Select value={defaultProvider} onValueChange={handleProviderChange}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="claude">
                        <div className="flex items-center gap-2">
                          <ProviderIcon provider="claude" className="h-3.5 w-3.5" />
                          <span>Claude</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="gemini">
                        <div className="flex items-center gap-2">
                          <ProviderIcon provider="gemini" className="h-3.5 w-3.5" />
                          <span>Gemini</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="codex">
                        <div className="flex items-center gap-2">
                          <ProviderIcon provider="codex" className="h-3.5 w-3.5" />
                          <span>OpenAI</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="kimi">
                        <div className="flex items-center gap-2">
                          <ProviderIcon provider="kimi" className="h-3.5 w-3.5" />
                          <span>Kimi</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Default Model</Label>
                  <Select value={defaultModel} onValueChange={onDefaultModelChange}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {modelOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
