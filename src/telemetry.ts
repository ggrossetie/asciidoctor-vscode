import TelemetryReporter from '@vscode/extension-telemetry'

// telemetry reporter
let telemetryReporter: TelemetryReporter | undefined

export function activate (): TelemetryReporter {
  telemetryReporter = new TelemetryReporter('InstrumentationKey=3d9d7208-5d18-4bba-a718-1f9fb2635c59;IngestionEndpoint=https://westeurope-5.in.applicationinsights.azure.com/;LiveEndpoint=https://westeurope.livediagnostics.monitor.azure.com/;ApplicationId=55f9c9e8-97aa-4543-a545-1bc5c7fb70d1')
  return telemetryReporter
}

export function sendTelemetryEvent (eventName: string) {
  telemetryReporter?.sendTelemetryEvent(eventName)
}

export function sendTelemetryErrorEvent (eventName: string) {
  telemetryReporter?.sendTelemetryErrorEvent('sampleErrorEvent', {
    stringProp: 'some string',
    stackProp: 'some user stack trace',
  })
}
