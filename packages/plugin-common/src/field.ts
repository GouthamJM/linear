import { FieldDefinitionNode } from "graphql";
import { PluginContext } from "./types";
import { reduceTypeName } from "./utils";

/**
 * Determine whether the node is a scalar field
 */
export function isScalarField(context: PluginContext, node: FieldDefinitionNode): boolean {
  return Object.keys(context.scalars).includes(reduceTypeName(node.type));
}

/**
 * Determine whether to the field is valid to be output
 *
 * Use config skipFields to skip fields with specific names
 * Use config skipDirectives to skip fields with specific directives
 */
export function isValidField(context: PluginContext, field?: FieldDefinitionNode): field is FieldDefinitionNode {
  if (field && field.name.value !== "edges") {
    const skipFieldName = context.config.skipFields?.includes(field?.name.value ?? "");
    const skipDirective = field?.directives?.find(d => context.config.skipDirectives?.includes(d.name.value));
    return Boolean(!skipDirective && !skipFieldName);
  } else {
    return false;
  }
}