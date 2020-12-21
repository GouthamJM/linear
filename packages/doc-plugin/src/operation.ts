import { filterJoin, getLast } from "@linear/common";
import { FieldDefinitionNode, ObjectTypeDefinitionNode, StringValueNode } from "graphql";
import { getTypeName, isScalarField, isValidField, printInputArgs, printResponseArgs } from "./field";
import { findFragment, printOperationFragment } from "./fragment";
import { findObject } from "./object";
import { findQuery } from "./query";
import { OperationType, OperationVisitorContext } from "./types";

/**
 * Print the description as a graphql file comment
 */
export function printDescription<T extends { description?: StringValueNode }>(node: T): string | undefined {
  return node.description?.value ? filterJoin(["#", node.description.value], " ") : undefined;
}

/**
 * Print the operation wrapper
 */
export function printOperationWrapper(type: OperationType, fields: FieldDefinitionNode[], body: string): string {
  const lastField = getLast(fields);

  if (isValidField(lastField)) {
    const operationName = filterJoin(
      fields.map(field => field.name.value),
      "_"
    );

    return filterJoin(
      [
        printDescription(lastField),
        `${type} ${operationName}${printInputArgs(fields)} {`,
        fields
          .slice()
          .reverse()
          .reduce((acc, field) => {
            return `${field.name.value}${printResponseArgs(field)} {
          ${acc === "" ? body : acc}
        }`;
          }, ""),
        `}`,
      ],
      "\n"
    );
  } else {
    return "";
  }
}

/**
 * Nest the objects until a fragment or scalar is found
 */
function printOperationFields(
  context: OperationVisitorContext,
  fields: FieldDefinitionNode[],
  object: ObjectTypeDefinitionNode
): string {
  const lastField = getLast(fields);
  return isValidField(lastField)
    ? filterJoin(
        object.fields?.map(field => {
          if (isValidField(field)) {
            const operation = printOperationBody(context, [field]);

            return operation
              ? filterJoin(
                  [
                    printDescription(field),
                    `${field.name.value} {
                      ${operation}
                    }`,
                  ],
                  "\n"
                )
              : field.name.value;
          } else {
            /** Skip fields that should not be exposed */
            return undefined;
          }
        }),
        "\n"
      )
    : "";
}

/**
 * Print the body of the operation
 */
export function printOperationBody(
  context: OperationVisitorContext,
  fields: FieldDefinitionNode[]
): string | undefined {
  const lastField = getLast(fields);

  if (isValidField(lastField)) {
    /** Spread the fragment if found */
    const fragment = findFragment(context.fragments, lastField);
    if (fragment) {
      return printOperationFragment(fragment);
    }

    /** Print each field if a matching object exists */
    const object = findObject(context.objects, lastField);
    if (object) {
      return printOperationFields(context, fields, object);
    }
  }

  return undefined;
}

export function printFieldOperation(
  context: OperationVisitorContext,
  type: OperationType,
  fields: FieldDefinitionNode[]
): string | undefined {
  const body = printOperationBody(context, fields);
  return body ? printOperationWrapper(type, fields, body) : undefined;
}

/**
 * Print an operation for the node as well as a query for any nested fields
 *
 * @param context the operation visitor context
 * @param type either a query or a mutation
 * @param fields a list of fields by which to nest the query
 * @param index the recursion index
 */
export function printOperations(
  context: OperationVisitorContext,
  type: OperationType,
  fields: FieldDefinitionNode[]
): string | undefined {
  const lastField = getLast(fields);

  if (isValidField(lastField)) {
    /** Print the operation for the latest field */
    const nodeOperation = printFieldOperation(context, type, fields);

    if (type === OperationType.query) {
      /** Find an object matching the type of this query */
      const object = findObject(context.objects, lastField);

      const fieldOperations = (object?.fields ?? [])?.map(childField => {
        if (
          /** No need to go further than scalar fields */
          isScalarField(context.scalars, childField) ||
          /** No need to go further if the field returns one of the parent fields */
          fields.map(f => getTypeName(f.type)).includes(getTypeName(childField.type)) ||
          /** No need to go further if the field is a connection */
          ["pageInfo", "nodes"].includes(childField.name.value) ||
          /** No need to go further if we can get this field from a root query */
          findQuery(context.queries, childField)
        ) {
          return undefined;
        } else {
          /** For any objects create a new query for each nested field */
          return printOperations(context, type, [...fields, childField]);
        }
      });

      /** Return operation for this node as well as any nested field operations */
      return filterJoin([nodeOperation, ...fieldOperations], "\n");
    } else {
      /** Do not nest mutations */
      return nodeOperation;
    }
  } else {
    return undefined;
  }
}
