import { defineConfig } from 'wxt';
export default defineConfig({
  manifestVersion: 3,
  manifest: {
    name: 'TinkerCode',
    description: 'Lightweight Arduino autocomplete for Tinkercad Circuits.',
    browser_specific_settings: { gecko: { id: 'tinkercode@local.invalid', strict_min_version: '128.0', data_collection_permissions: { required: ['none'] } } },
  },
});

