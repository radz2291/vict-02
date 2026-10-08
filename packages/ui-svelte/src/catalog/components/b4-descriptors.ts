/** B4 authored menu composition and declared state/action connections. */
import type { UiExtensionDescriptor } from '@victframework/ui';

export const b4CatalogDescriptors: readonly UiExtensionDescriptor[] = [
  {
    "id": "vict.catalog.dropdown-menu",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "open",
        "type": "boolean",
        "default": false
      }
    ],
    "outputs": [
      {
        "name": "openChange",
        "payload": "boolean"
      }
    ],
    "slots": [
      "trigger",
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root",
      "content"
    ]
  },
  {
    "id": "vict.catalog.context-menu",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "open",
        "type": "boolean",
        "default": false
      }
    ],
    "outputs": [
      {
        "name": "openChange",
        "payload": "boolean"
      }
    ],
    "slots": [
      "trigger",
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root",
      "content"
    ]
  },
  {
    "id": "vict.catalog.menubar",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "value",
        "type": "string",
        "default": ""
      },
      {
        "name": "loop",
        "type": "boolean",
        "default": true
      }
    ],
    "outputs": [
      {
        "name": "valueChange",
        "payload": "string"
      }
    ],
    "slots": [
      "menus"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.menubar.menu",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "value",
        "type": "string",
        "default": ""
      }
    ],
    "outputs": [
      {
        "name": "openChange",
        "payload": "boolean"
      }
    ],
    "slots": [
      "trigger",
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root",
      "content"
    ]
  },
  {
    "id": "vict.catalog.dropdown-menu.item",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "value",
        "type": "string",
        "default": ""
      },
      {
        "name": "closeOnSelect",
        "type": "boolean",
        "default": true
      }
    ],
    "outputs": [
      {
        "name": "itemActivate",
        "payload": "string"
      }
    ],
    "slots": [
      "content"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.dropdown-menu.sub",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "open",
        "type": "boolean",
        "default": false
      }
    ],
    "outputs": [
      {
        "name": "openChange",
        "payload": "boolean"
      }
    ],
    "slots": [
      "trigger",
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root",
      "content"
    ]
  },
  {
    "id": "vict.catalog.dropdown-menu.checkbox-item",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "value",
        "type": "string",
        "default": ""
      },
      {
        "name": "checked",
        "type": "boolean",
        "default": false
      },
      {
        "name": "indeterminate",
        "type": "boolean",
        "default": false
      },
      {
        "name": "closeOnSelect",
        "type": "boolean",
        "default": false
      }
    ],
    "outputs": [
      {
        "name": "checkedChange",
        "payload": "boolean"
      },
      {
        "name": "indeterminateChange",
        "payload": "boolean"
      }
    ],
    "slots": [
      "content"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.dropdown-menu.checkbox-group",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "values",
        "type": "stringList",
        "default": []
      }
    ],
    "outputs": [
      {
        "name": "valuesChange",
        "payload": "stringList"
      }
    ],
    "slots": [
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.dropdown-menu.radio-group",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "value",
        "type": "string",
        "default": ""
      }
    ],
    "outputs": [
      {
        "name": "valueChange",
        "payload": "string"
      }
    ],
    "slots": [
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.dropdown-menu.radio-item",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "value",
        "type": "string",
        "default": ""
      },
      {
        "name": "closeOnSelect",
        "type": "boolean",
        "default": false
      }
    ],
    "outputs": [
      {
        "name": "itemActivate",
        "payload": "string"
      }
    ],
    "slots": [
      "content"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.dropdown-menu.group",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      }
    ],
    "outputs": [],
    "slots": [
      "heading",
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.dropdown-menu.separator",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [],
    "outputs": [],
    "slots": [],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.context-menu.item",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "value",
        "type": "string",
        "default": ""
      },
      {
        "name": "closeOnSelect",
        "type": "boolean",
        "default": true
      }
    ],
    "outputs": [
      {
        "name": "itemActivate",
        "payload": "string"
      }
    ],
    "slots": [
      "content"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.context-menu.sub",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "open",
        "type": "boolean",
        "default": false
      }
    ],
    "outputs": [
      {
        "name": "openChange",
        "payload": "boolean"
      }
    ],
    "slots": [
      "trigger",
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root",
      "content"
    ]
  },
  {
    "id": "vict.catalog.context-menu.checkbox-item",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "value",
        "type": "string",
        "default": ""
      },
      {
        "name": "checked",
        "type": "boolean",
        "default": false
      },
      {
        "name": "indeterminate",
        "type": "boolean",
        "default": false
      },
      {
        "name": "closeOnSelect",
        "type": "boolean",
        "default": false
      }
    ],
    "outputs": [
      {
        "name": "checkedChange",
        "payload": "boolean"
      },
      {
        "name": "indeterminateChange",
        "payload": "boolean"
      }
    ],
    "slots": [
      "content"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.context-menu.checkbox-group",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "values",
        "type": "stringList",
        "default": []
      }
    ],
    "outputs": [
      {
        "name": "valuesChange",
        "payload": "stringList"
      }
    ],
    "slots": [
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.context-menu.radio-group",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "value",
        "type": "string",
        "default": ""
      }
    ],
    "outputs": [
      {
        "name": "valueChange",
        "payload": "string"
      }
    ],
    "slots": [
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.context-menu.radio-item",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "value",
        "type": "string",
        "default": ""
      },
      {
        "name": "closeOnSelect",
        "type": "boolean",
        "default": false
      }
    ],
    "outputs": [
      {
        "name": "itemActivate",
        "payload": "string"
      }
    ],
    "slots": [
      "content"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.context-menu.group",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      }
    ],
    "outputs": [],
    "slots": [
      "heading",
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.context-menu.separator",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [],
    "outputs": [],
    "slots": [],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.menubar.item",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "value",
        "type": "string",
        "default": ""
      },
      {
        "name": "closeOnSelect",
        "type": "boolean",
        "default": true
      }
    ],
    "outputs": [
      {
        "name": "itemActivate",
        "payload": "string"
      }
    ],
    "slots": [
      "content"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.menubar.sub",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "open",
        "type": "boolean",
        "default": false
      }
    ],
    "outputs": [
      {
        "name": "openChange",
        "payload": "boolean"
      }
    ],
    "slots": [
      "trigger",
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root",
      "content"
    ]
  },
  {
    "id": "vict.catalog.menubar.checkbox-item",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "value",
        "type": "string",
        "default": ""
      },
      {
        "name": "checked",
        "type": "boolean",
        "default": false
      },
      {
        "name": "indeterminate",
        "type": "boolean",
        "default": false
      },
      {
        "name": "closeOnSelect",
        "type": "boolean",
        "default": false
      }
    ],
    "outputs": [
      {
        "name": "checkedChange",
        "payload": "boolean"
      },
      {
        "name": "indeterminateChange",
        "payload": "boolean"
      }
    ],
    "slots": [
      "content"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.menubar.checkbox-group",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "values",
        "type": "stringList",
        "default": []
      }
    ],
    "outputs": [
      {
        "name": "valuesChange",
        "payload": "stringList"
      }
    ],
    "slots": [
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.menubar.radio-group",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "value",
        "type": "string",
        "default": ""
      }
    ],
    "outputs": [
      {
        "name": "valueChange",
        "payload": "string"
      }
    ],
    "slots": [
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.menubar.radio-item",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "value",
        "type": "string",
        "default": ""
      },
      {
        "name": "closeOnSelect",
        "type": "boolean",
        "default": false
      }
    ],
    "outputs": [
      {
        "name": "itemActivate",
        "payload": "string"
      }
    ],
    "slots": [
      "content"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.menubar.group",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      }
    ],
    "outputs": [],
    "slots": [
      "heading",
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.menubar.separator",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [],
    "outputs": [],
    "slots": [],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.command",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "value",
        "type": "string",
        "default": ""
      },
      {
        "name": "search",
        "type": "string",
        "default": ""
      },
      {
        "name": "placeholder",
        "type": "string",
        "default": ""
      },
      {
        "name": "loop",
        "type": "boolean",
        "default": true
      }
    ],
    "outputs": [
      {
        "name": "valueChange",
        "payload": "string"
      },
      {
        "name": "searchChange",
        "payload": "string"
      }
    ],
    "slots": [
      "items",
      "empty"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.command.item",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "value",
        "type": "string",
        "default": ""
      },
      {
        "name": "keywords",
        "type": "stringList",
        "default": []
      }
    ],
    "outputs": [
      {
        "name": "itemActivate",
        "payload": "string"
      }
    ],
    "slots": [
      "content"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.command.group",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "value",
        "type": "string",
        "default": ""
      }
    ],
    "outputs": [],
    "slots": [
      "heading",
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.navigation-menu",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "value",
        "type": "string",
        "default": ""
      },
      {
        "name": "orientation",
        "type": "string",
        "default": "horizontal"
      }
    ],
    "outputs": [
      {
        "name": "valueChange",
        "payload": "string"
      }
    ],
    "slots": [
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.navigation-menu.item",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "disabled",
        "type": "boolean",
        "default": false
      },
      {
        "name": "value",
        "type": "string",
        "default": ""
      },
      {
        "name": "openOnHover",
        "type": "boolean",
        "default": true
      }
    ],
    "outputs": [],
    "slots": [
      "trigger",
      "content"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root",
      "content"
    ]
  },
  {
    "id": "vict.catalog.navigation-menu.link",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "label",
        "type": "string",
        "default": ""
      },
      {
        "name": "href",
        "type": "string",
        "default": ""
      },
      {
        "name": "active",
        "type": "boolean",
        "default": false
      }
    ],
    "outputs": [
      {
        "name": "activate",
        "payload": "void"
      }
    ],
    "slots": [
      "content"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
  {
    "id": "vict.catalog.navigation-menu.sub",
    "revision": "1",
    "abi": "vict.ui-component-abi@1",
    "events": [
      "vict.ui-component-abi@1"
    ],
    "props": [
      {
        "name": "value",
        "type": "string",
        "default": ""
      },
      {
        "name": "orientation",
        "type": "string",
        "default": "horizontal"
      }
    ],
    "outputs": [
      {
        "name": "valueChange",
        "payload": "string"
      }
    ],
    "slots": [
      "items"
    ],
    "rendererImplementationId": "vict.svelte.catalog",
    "styleTargets": [
      "root"
    ]
  },
];
