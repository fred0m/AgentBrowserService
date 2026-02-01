/**
 * MCP 工具定义
 * 定义了所有可通过 MCP 协议调用的浏览器操作工具
 */

export interface MCPTool {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
}

export const MCP_TOOLS: MCPTool[] = [
    {
        name: 'session_create',
        description: '创建一个新的浏览器会话。返回 session_id 用于后续操作。',
        inputSchema: {
            type: 'object',
            properties: {},
            required: [],
        },
    },
    {
        name: 'session_close',
        description: '关闭指定的浏览器会话，释放资源。',
        inputSchema: {
            type: 'object',
            properties: {
                session_id: {
                    type: 'string',
                    description: '要关闭的会话 ID',
                },
            },
            required: ['session_id'],
        },
    },
    {
        name: 'page_open',
        description: '在指定会话中打开一个 URL。',
        inputSchema: {
            type: 'object',
            properties: {
                session_id: {
                    type: 'string',
                    description: '会话 ID',
                },
                url: {
                    type: 'string',
                    description: '要打开的 URL',
                },
            },
            required: ['session_id', 'url'],
        },
    },
    {
        name: 'page_snapshot',
        description: '获取当前页面的紧凑快照，包含标题、URL、主要文本和可交互元素列表（带 ref）。',
        inputSchema: {
            type: 'object',
            properties: {
                session_id: {
                    type: 'string',
                    description: '会话 ID',
                },
                mode: {
                    type: 'string',
                    enum: ['compact', 'text_only', 'actions_only'],
                    description: '快照模式：compact (完整), text_only (仅文本), actions_only (仅动作列表)',
                    default: 'compact',
                },
            },
            required: ['session_id'],
        },
    },
    {
        name: 'page_click',
        description: '点击页面上的某个元素（通过 ref 引用，ref 来自 page_snapshot 的 actions）。',
        inputSchema: {
            type: 'object',
            properties: {
                session_id: {
                    type: 'string',
                    description: '会话 ID',
                },
                ref: {
                    type: 'string',
                    description: '元素引用 ID（来自 snapshot）',
                },
            },
            required: ['session_id', 'ref'],
        },
    },
    {
        name: 'page_fill',
        description: '填充输入框（通过 ref 引用）。',
        inputSchema: {
            type: 'object',
            properties: {
                session_id: {
                    type: 'string',
                    description: '会话 ID',
                },
                ref: {
                    type: 'string',
                    description: '输入框元素引用 ID（来自 snapshot）',
                },
                text: {
                    type: 'string',
                    description: '要填充的文本',
                },
            },
            required: ['session_id', 'ref', 'text'],
        },
    },
    {
        name: 'page_press',
        description: '模拟按键操作（如 Enter, Escape 等）。',
        inputSchema: {
            type: 'object',
            properties: {
                session_id: {
                    type: 'string',
                    description: '会话 ID',
                },
                key: {
                    type: 'string',
                    description: '按键名称（如 "Enter", "Escape", "ArrowDown"）',
                },
            },
            required: ['session_id', 'key'],
        },
    },
    {
        name: 'page_wait',
        description: '等待指定毫秒数（用于等待页面加载或动画）。',
        inputSchema: {
            type: 'object',
            properties: {
                session_id: {
                    type: 'string',
                    description: '会话 ID',
                },
                ms: {
                    type: 'number',
                    description: '等待时长（毫秒）',
                    default: 1000,
                },
            },
            required: ['session_id'],
        },
    },
];
