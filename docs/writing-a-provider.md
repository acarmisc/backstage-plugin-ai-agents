# Writing a provider module

Without a matching module the endpoint answers 501 and the frontend falls
back to the CLI-copy flow — other organisations can plug their own invoker
(Lambda, Azure ML, HTTP…) by implementing `AgentInvoker` from the backend
package and registering it under a runtime key of their choosing.
