"""UsageObserver: MetricsFrame -> running UsageReport. STTUsageMetricsData by processor -> sttSecondsByKey (flux
primary vs nova tap), TTSUsageMetricsData -> ttsCharsByKey/family (active switcher member), LLMUsageMetricsData ->
llmByKey[active think key] (tokens carry no processor/model name: attribute to the model active at the time),
connectedMs(+ByTier), redact/keyterm seconds. Throttled VcUsage <= 1/s; final put into deps.usage on disconnect."""
