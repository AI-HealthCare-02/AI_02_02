from pydantic import BaseModel


class MCPToolDescriptor(BaseModel):
    name: str
    description: str
    input_schema: dict


class MCPServerManifest(BaseModel):
    server_name: str
    version: str
    tools: list[MCPToolDescriptor]
