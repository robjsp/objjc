/*
 * code_generator.js
 *
 * Created by Martin Carlberg.
 * Copyright 2013, Martin Carlberg.
 *
 * Additional work by Aparajita Fishman.
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the MIT license (http://opensource.org/licenses/MIT).
 */

"use strict";

var exceptions = require("./exceptions"),
    globals = require("./globals"),
    language = require("./language"),
    indentation = require("./indentation"),
    Scope = require("./scope"),
    StringBuffer = require("./stringbuffer"),
    util = require("util"),
    utils = require("./utils"),
    walk = require("objj-acorn/util/walk");

var ClassDef = language.ClassDef,
    MethodDef = language.MethodDef,
    ProtocolDef = language.ProtocolDef;

var wordPrefixOperators = utils.arrayToHash(["delete", "in", "instanceof", "new", "typeof", "void"]);

var referenceTemplate = utils.makeTemplate(
    "{\n" +
        "→if (arguments.length)\n" +
            "→→return ${data.name} = __input;\n\n" +
        "→return ${data.name};\n" +
    "}"
);

// Helper for codeGenerator.MethodDeclaration
function checkMethodOverride(compiler, node, nodeArguments, types, returnType, alreadyDeclared, selector)
{
    var declaredTypes = alreadyDeclared.types;

    if (!declaredTypes)
        return;

    if (declaredTypes.length === 0)
        return;

    // First type is return type
    var declaredReturnType = declaredTypes[0];

    // Create warning if return types are not the same.
    // It is ok if superclass has 'id' and subclass has a class type.
    if (declaredReturnType !== types[0] &&
        !(declaredReturnType === "id" && returnType && returnType.typeisclass))
    {
        compiler.addWarning(
            returnType || node.action || node.selectors[0],
            "conflicting return type in implementation of '%s': '%s' vs '%s'",
            selector,
            declaredReturnType,
            types[0]
        );

        compiler.addNote(
            alreadyDeclared.node.returntype,
            "previous implementation is here"
        );
    }

    // Check the parameter types. The count of the two type arrays
    // should be the same as they have the same selector.
    for (var i = 1; i < declaredTypes.length; i++)
    {
        var parameterType = declaredTypes[i];

        if (parameterType !== types[i] &&
            !(parameterType === "id" && nodeArguments[i - 1].type.typeisclass))
        {
            compiler.addWarning(
                nodeArguments[i - 1].type || nodeArguments[i - 1].identifier,
                "conflicting parameter type in implementation of '%s': '%s' vs '%s'",
                selector,
                parameterType,
                types[i]
            );

            compiler.addNote(
                alreadyDeclared.node.arguments[i - 1].type,
                "previous implementation is here"
            );
        }
    }
}

function checkForHiddenGlobalVar(node, scope)
{
    var compiler = scope.compiler,
        identifier = node.name,
        shadowType,
        shadowedNode;

    if (identifier in compiler.predefinedGlobals)
    {
        shadowType = "a predefined global";
    }
    else if (compiler.identifierIsGlobal(identifier))
    {
        shadowType = "a global variable";
        shadowedNode = compiler.getGlobal(identifier);
    }
    else
    {
        var fileVar = scope.rootScope().getVar(identifier);

        if (fileVar)
        {
            var fileVarTypes = {
                "@global": "a @global declaration",
                "@class": "a @class declaration",
                "file var": "a file variable"
            };

            shadowType = fileVarTypes[fileVar.type];
            shadowedNode = fileVar.node;
        }
        else
        {
            var classDef = compiler.getClassDef(identifier);

            if (classDef)
            {
                shadowType = "a class";
                shadowedNode = classDef.node.classname;
            }
        }
    }

    if (shadowType)
    {
        compiler.addWarning(
            node,
            "local declaration of '%s' hides %s",
            identifier,
            shadowType
        );

        if (shadowedNode)
            compiler.addNote(shadowedNode, "declaration is here");
    }
}

// This is only called in assignments or references in expressions, not for declared variables.
function validateIdentifierReference(node, scope)
{
    var compiler = scope.compiler,
        identifier = node.name,
        fileVar = scope.rootScope().getVar(identifier);

    if (fileVar)
        return;

    var predefined = compiler.predefinedGlobal(identifier);

    if (predefined === undefined)
    {
        if (scope.assignment)
        {
            if (compiler.shouldWarnAbout("implicit-globals"))
            {
                var scopeVar = scope.vars[identifier];

                if (!scopeVar || scopeVar.type !== "implicit global")
                {
                    var context = scope.functionName || scope.selector;

                    compiler.addIssue(
                        exceptions.ImplicitGlobalWarning,
                        node,
                        "implicitly creating a global variable in the %s '%s'; did you mean to use var?",
                        scope.functionName ? "function" : "method",
                        context
                    );

                    // Turn off these warnings for this identifier, we only want one.
                    scope.vars[identifier] = { type: "implicit global", node: node };
                }
            }
        }
        else if (compiler.shouldWarnAbout("unknown-identifiers"))
        {
            if (!scope.getLocalVar(identifier) && !compiler.getClassDef(identifier))
            {
                var suggestion = "";

                // It could be a misspelled class name
                if (scope.receiver)
                {
                    var classDef = compiler.findClassDef(identifier);

                    if (classDef)
                        suggestion = "; did you mean '" + classDef.name + "'?";
                }

                compiler.addIssue(
                    exceptions.UnknownIdentifierWarning,
                    node,
                    "reference to unknown identifier '%s'%s",
                    identifier,
                    suggestion
                );
            }
        }
    }
    else if (scope.assignment && predefined === false)
    {
        compiler.addWarning(node, "assigning to a read-only predefined global");
    }
}

module.exports = walk.make({  // jshint ignore:line

Program: function(node, scope, compileNode)
{
    var compiler = scope.compiler,
        indentString = compiler.format.valueForProperty(scope, "*", "indent-string"),
        indentWidth = compiler.format.valueForProperty(scope, "*", "indent-width");

    indentString = indentString || compiler.defaultOptions.indentString;
    indentWidth = indentWidth || compiler.defaultOptions.indentWidth;
    indentation.setIndent(indentString, indentWidth);

    for (var i = 0; i < node.body.length; i++)
        compileNode(node.body[i], scope);

    scope.close();
    compiler.filterIdentifierIssues(scope);
},

BlockStatement: function(node, scope, compileNode)
{
    var buffer = scope.compiler.jsBuffer;

    buffer.concatWithFormats(node, scope, null, "{", "after-left-brace");
    indentation.indent();

    for (var i = 0; i < node.body.length; i++)
        compileNode(node.body[i], scope);

    scope.close();
    indentation.dedent();
    buffer.concatWithFormats(node, scope, "before-right-brace", "}");
},

ExpressionStatement: function(node, scope, compileNode)
{
    compileNode(node.expression, scope);
},

IfStatement: function(node, scope, compileNode)
{
    var compiler = scope.compiler,
        buffer = compiler.jsBuffer;

    buffer.concat("if", node);
    compiler.concatParenthesizedExpression(node, scope, compileNode, node.test);
    compiler.compileDependentStatement(node.consequent, scope, compileNode);

    if (node.alternate)
    {
        var isElseIf = node.alternate.type === "IfStatement",
            type = isElseIf ? "ElseIfStatement" : "IfStatement";

        buffer.concatWithFormat(node, scope, "else", null, true, type);

        if (isElseIf)
            compileNode(node.alternate, scope, "ElseIfStatement");
        else
            compiler.compileDependentStatement(node.alternate, scope, compileNode);
    }
},

ElseIfStatement: function(node, scope, compileNode)
{
    compileNode(node, scope);
},

LabeledStatement: function(node, scope, compileNode)
{
    var buffer = scope.compiler.jsBuffer;

    compileNode(node.label, scope, "IdentifierName");
    buffer.concatWithFormat(node, scope, ":", "colon");
    compileNode(node.body, scope);
},

BreakStatement: function(node, scope, compileNode)
{
    var label = node.label,
        buffer = scope.compiler.jsBuffer;

    if (label)
    {
        buffer.concatWithFormats(node, scope, null, "break", "before-label", true);
        compileNode(label, scope, "IdentifierName");
    }
    else
        buffer.concat("break", node);
},

ContinueStatement: function(node, scope, compileNode)
{
    var label = node.label,
        buffer = scope.compiler.jsBuffer;

    if (label)
    {
        buffer.concatWithFormats(node, scope, null, "continue", "before-label", true);
        compileNode(label, scope, "IdentifierName");
    }
    else
        buffer.concat("continue", node);
},

WithStatement: function(node, scope, compileNode)
{
    var compiler = scope.compiler,
        buffer = compiler.jsBuffer;

    buffer.concat("with", node);
    compiler.concatParenthesizedExpression(node, scope, compileNode, node.object);
    compiler.compileDependentStatement(node.body, scope, compileNode);
},

SwitchStatement: function(node, scope, compileNode)
{
    var compiler = scope.compiler,
        buffer = compiler.jsBuffer;

    buffer.concat("switch", node);
    compiler.concatParenthesizedExpression(node, scope, compileNode, node.discriminant);
    buffer.concatWithFormat(node, scope, "{", "left-brace");

    for (var i = 0; i < node.cases.length; i++)
    {
        var cs = node.cases[i];

        if (cs.test)
        {
            buffer.concatWithFormats(node, scope, "before-case", "case ", null, true);
            compileNode(cs.test, scope);
            buffer.concatWithFormat(node, scope, ":", "colon");
        }
        else
        {
            buffer.concatWithFormats(node, scope, "before-case", "default", null, true);
            buffer.concatWithFormat(node, scope, ":", "colon");
        }

        if (cs.consequent.length > 0)
        {
            indentation.indent();

            for (var j = 0; j < cs.consequent.length; j++)
                compileNode(cs.consequent[j], scope);

            indentation.dedent();

            if (i < node.cases.length - 1)
                buffer.concatFormat(node, scope, "between-case-blocks");
        }
    }

    buffer.concatWithFormat(node, scope, "}", "right-brace");
},

ReturnStatement: function(node, scope, compileNode)
{
    var buffer = scope.compiler.jsBuffer;

    buffer.concat("return" + (node.argument ? " " : ""), node);

    if (node.argument)
        compileNode(node.argument, scope);
},

ThrowStatement: function(node, scope, compileNode)
{
    scope.compiler.jsBuffer.concat("throw ", node);
    compileNode(node.argument, scope);
},

TryStatement: function(node, scope, compileNode)
{
    var buffer = scope.compiler.jsBuffer;

    buffer.concat("try", node);
    compileNode(node.block, scope);

    if (node.handler)
    {
        var handler = node.handler,
            param = handler.param,
            name = param.name;

        // Inject the catch variable into the scope
        scope.vars[name] = { type: "local var", node: param };

        buffer.concatWithFormats(node, scope, "before-catch", "catch");
        buffer.concatLeftParens(node, scope);
        compileNode(param, scope, "IdentifierName");
        buffer.concatRightParens(node, scope);

        compileNode(handler.body, scope);

        delete scope.vars[name];
    }

    if (node.finalizer)
    {
        buffer.concatWithFormats(node, scope, "before-finally", "finally");
        compileNode(node.finalizer, scope);
    }
},

WhileStatement: function(node, scope, compileNode)
{
    var compiler = scope.compiler,
        buffer = compiler.jsBuffer;

    buffer.concat("while", node);
    compiler.concatParenthesizedExpression(node, scope, compileNode, node.test);

    indentation.indent();
    compileNode(node.body, scope);
    indentation.dedent();
},

DoWhileStatement: function(node, scope, compileNode)
{
    var compiler = scope.compiler,
        buffer = compiler.jsBuffer;

    buffer.concat("do", node);

    indentation.indent();
    compileNode(node.body, scope);
    indentation.dedent();

    buffer.concat("while", node);
    compiler.concatParenthesizedExpression(node, scope, compileNode, node.test);
},

ForStatement: function(node, scope, compileNode)
{
    var compiler = scope.compiler,
        buffer = compiler.jsBuffer;

    buffer.concat("for", node);
    buffer.concatLeftParens(node, scope);

    if (node.init)
        compileNode(node.init, scope, "ForInit");

    buffer.concatWithFormats(node, scope, "after-init-expression", ";", "after-init-semicolon");

    if (node.test)
        compileNode(node.test, scope);

    buffer.concatWithFormats(node, scope, "after-init-expression", ";", "after-init-semicolon");

    if (node.update)
        compileNode(node.update, scope);

    buffer.concatRightParens(node, scope);
    compiler.compileDependentStatement(node.body, scope, compileNode);
},

ForInit: function(node, scope, compileNode)
{
    compileNode(node, scope);
},

ForInStatement: function(node, scope, compileNode)
{
    var buffer = scope.compiler.jsBuffer;

    buffer.concat("for", node);

    buffer.concatLeftParens(node, scope);
    compileNode(node.left, scope);

    buffer.concatWithFormat(node, scope, "in");
    compileNode(node.right, scope);
    buffer.concatRightParens(node, scope);

    indentation.indent();
    compileNode(node.body, scope);
    indentation.dedent();
},

DebuggerStatement: function(node, scope)
{
    var compiler = scope.compiler;

    compiler.jsBuffer.concat("debugger", node);

    if (compiler.shouldWarnAbout("debugger"))
        compiler.addWarning(node, "debugger statement");
},

Function: function(node, scope, compileNode)
{
    var compiler = scope.compiler,
        buffer = compiler.jsBuffer,
        inner = new Scope(scope),
        decl = node.type === "FunctionDeclaration",
        id = node.id;

    inner.isDecl = decl;
    inner.functionName = id ? id.name : "<anonymous>";

    for (var i = 0; i < node.params.length; i++)
        inner.vars[node.params[i].name] = { type: "argument", node: node.params[i] };

    if (id)
    {
        var name = id.name;
        (decl ? scope : inner).vars[name] = { type: decl ? "function" : "function name", node: id };

        if (compiler.options.transformNamedFunctionToAssignment)
        {
            buffer.concat(name);
            buffer.concatWithFormat(node, scope, "=", "assign");
        }
    }

    buffer.concat("function", node);

    if (!compiler.options.transformNamedFunctionToAssignment && id)
    {
        buffer.concat(" ");
        compileNode(id, scope, "IdentifierName");
    }

    buffer.concatLeftParens(node, scope);

    for (var i = 0; i < node.params.length; i++)
    {
        if (i > 0)
            buffer.concatComma(node, scope);

        compileNode(node.params[i], scope, "IdentifierName");
    }

    buffer.concatRightParens(node, scope);

    compileNode(node.body, inner);

    inner.copyIvarRefsToParent();
},

VariableDeclaration: function(node, scope, compileNode)
{
    var compiler = scope.compiler,
        buffer = compiler.jsBuffer;

    buffer.concat("var ", node);

    for (var i = 0; i < node.declarations.length; i++)
    {
        var decl = node.declarations[i],
            identifier = decl.id.name;

        if (i > 0)
            buffer.concatComma(node, scope);

        if (identifier in globals.reserved)
            compiler.addWarning(node, "reserved word used for variable name");
        else if (scope.isLocalScope() && compiler.shouldWarnAbout("hidden-globals"))
            checkForHiddenGlobalVar(decl.id, scope);

        scope.vars[identifier] = {
            type: scope.isLocalScope() ? "local var" : "file var",
            node: decl.id
        };

        compileNode(decl.id, scope, "IdentifierName");

        if (decl.init)
        {
            buffer.concatWithFormat(node, scope, "=", "assign");
            compileNode(decl.init, scope);
        }

        if (scope.ivarRefs)
            compiler.checkForShadowedIvar(scope, identifier);
    }
},

ThisExpression: function(node, scope)
{
    scope.compiler.jsBuffer.concat("this", node);
},

ArrayExpression: function(node, scope, compileNode)
{
    var buffer = scope.compiler.jsBuffer;

    buffer.concatWithFormat(node, scope, "[", "left-bracket", true);

    for (var i = 0; i < node.elements.length; i++)
    {
        var element = node.elements[i];

        if (i !== 0)
            buffer.concatComma(node, scope);

        if (element)
            compileNode(element, scope);
    }

    buffer.concatWithFormat(node, scope, "]", "right-bracket");
},

ObjectExpression: function(node, scope, compileNode)
{
    var properties = node.properties,
        buffer = scope.compiler.jsBuffer;

    buffer.concatWithFormat(node, scope, "{", "left-brace", true);

    for (var i = 0; i < properties.length; i++)
    {
        var property = properties[i];

        if (i)
            buffer.concatComma(node, scope);

        scope.isPropertyKey = true;
        compileNode(property.key, scope);
        delete scope.isPropertyKey;

        buffer.concatWithFormat(node, scope, ":", "colon");
        compileNode(property.value, scope);
    }

    buffer.concatWithFormat(node, scope, "}", "right-brace");
},

SequenceExpression: function(node, scope, compileNode)
{
    var buffer = scope.compiler.jsBuffer;

    buffer.concatLeftParens(node, scope);

    for (var i = 0; i < node.expressions.length; i++)
    {
        if (i !== 0)
            buffer.concatComma(node, scope);

        compileNode(node.expressions[i], scope);
    }

    buffer.concatRightParens(node, scope);
},

UnaryExpression: function(node, scope, compileNode)
{
    var compiler = scope.compiler,
        argument = node.argument,
        buffer = compiler.jsBuffer;

    if (node.prefix)
    {
        buffer.concat(node.operator, node);

        if (node.operator in wordPrefixOperators)
            buffer.concat(" ");

        compiler.concatPrecedenceExpression(node, argument, scope, compileNode);
    }
    else
    {
        compiler.concatPrecedenceExpression(node, argument, scope, compileNode);
        buffer.concat(node.operator);
    }
},

UpdateExpression: function(node, scope, compileNode)
{
    var compiler = scope.compiler,
        buffer = compiler.jsBuffer;

    if (node.argument.type === "Dereference")
    {
        // Output the dereference function, "(...)(z)"
        if (!node.prefix)
            buffer.concatLeftParens(node, scope);

        buffer.concatLeftParens(node, scope);
        compileNode(node.argument.expr, scope);
        buffer.concatRightParens(node, scope);

        buffer.concatLeftParens(node, scope);
        compileNode(node.argument, scope);
        buffer.concatOperator(node, scope, node.operator.charAt(0));
        buffer.concat("1");
        buffer.concatRightParens(node, scope);

        if (!node.prefix)
        {
            buffer.concatOperator(node, scope, node.operator === "++" ? "-" : "+");
            buffer.concat("1");
            buffer.concatRightParens(node, scope);
        }

        return;
    }

    if (node.prefix)
    {
        buffer.concat(node.operator, node);

        if (node.operator in wordPrefixOperators)
            buffer.concat(" ");

        compiler.concatPrecedenceExpression(node, node.argument, scope, compileNode);
    }
    else
    {
        compiler.concatPrecedenceExpression(node, node.argument, scope, compileNode);
        buffer.concat(node.operator);
    }
},

BinaryExpression: function(node, scope, compileNode)
{
    var compiler = scope.compiler,
        buffer = compiler.jsBuffer;

    compiler.concatPrecedenceExpression(node, node.left, scope, compileNode);
    buffer.concatOperator(node, scope);
    compiler.concatPrecedenceExpression(node, node.right, scope, compileNode, true);
},

LogicalExpression: function(node, scope, compileNode)
{
    var compiler = scope.compiler,
        buffer = compiler.jsBuffer;

    compiler.concatPrecedenceExpression(node, node.left, scope, compileNode);
    buffer.concatOperator(node, scope);
    compiler.concatPrecedenceExpression(node, node.right, scope, compileNode, true);
},

AssignmentExpression: function(node, scope, compileNode)
{
    var compiler = scope.compiler,
        buffer = compiler.jsBuffer,
        target = node.left;

    if (target.type === "Dereference")
    {
        // Output the dereference function, "(...)(z)"
        compiler.concatParenthesizedExpression(node, scope, compileNode, target.expr);
        buffer.concatLeftParens(node, scope);

        // Now "(x)(...)". We have to manually expand +=, -=, *= etc.
        if (node.operator === "=")
            compiler.checkCanDereference(scope, target);
        else
        {
            compileNode(target, scope);
            buffer.concatOperator(node, scope, node.operator.charAt(0));
        }

        compileNode(node.right, scope);
        buffer.concatRightParens(node, scope);
    }
    else
    {
        var saveAssignment = scope.assignment;

        scope.assignment = true;

        if (target.type === "Identifier" && target.name === "self")
        {
            var localVar = scope.getLocalVar("self");

            if (localVar)
            {
                var localVarScope = localVar.scope;

                if (localVarScope)
                    localVarScope.assignmentToSelf = true;
            }
        }

        compiler.concatPrecedenceExpression(node, target, scope, compileNode);
        buffer.concatOperator(node, scope);
        scope.assignment = saveAssignment;
        compiler.concatPrecedenceExpression(node, node.right, scope, compileNode, true);

        if (scope.isRootScope() && target.type === "Identifier" && !scope.getVar(target.name))
            compiler.addGlobal(target);
    }
},

ConditionalExpression: function(node, scope, compileNode)
{
    var compiler = scope.compiler,
        buffer = compiler.jsBuffer;

    compiler.concatPrecedenceExpression(node, node.test, scope, compileNode);
    buffer.concatOperator(node, scope, "?");
    compileNode(node.consequent, scope);
    buffer.concatOperator(node, scope, ":");
    compileNode(node.alternate, scope);
},

NewExpression: function(node, scope, compileNode)
{
    var compiler = scope.compiler,
        nodeArguments = node.arguments,
        buffer = compiler.jsBuffer,
        args;

    buffer.concat("new ", node);
    compiler.concatPrecedenceExpression(node, node.callee, scope, compileNode);

    if (nodeArguments && nodeArguments.length)
    {
        args = function()
        {
            for (var i = 0; i < nodeArguments.length; i++)
            {
                if (i > 0)
                    buffer.concatComma(node, scope);

                compileNode(nodeArguments[i], scope);
            }
        };
    }
    else
        args = null;

    buffer.concatParenthesizedBlock(node, scope, args);
},

CallExpression: function(node, scope, compileNode)
{
    var compiler = scope.compiler,
        nodeArguments = node.arguments,
        buffer = compiler.jsBuffer,
        func;

    // If call to function 'eval' we assume that 'self' can be altered and from this point
    // we check if 'self' is null before 'objj_msgSend' is called with 'self' as receiver.
    if (node.callee.type === "Identifier" && node.callee.name === "eval")
    {
        var selfVar = scope.getLocalVar("self");

        if (selfVar)
        {
            var selfScope = selfVar.scope;

            if (selfScope)
                selfScope.assignmentToSelf = true;
        }
    }

    compiler.concatPrecedenceExpression(node, node.callee, scope, compileNode);

    if (nodeArguments && nodeArguments.length > 0)
    {
        func = function()
        {
            for (var i = 0; i < nodeArguments.length; i++)
            {
                if (i > 0)
                    buffer.concatComma(node, scope);

                compileNode(nodeArguments[i], scope);
            }
        };
    }
    else
        func = null;

    buffer.concatParenthesizedBlock(node, scope, func);
},

MemberExpression: function(node, scope, compileNode)
{
    var compiler = scope.compiler,
        buffer = compiler.jsBuffer,
        computed = node.computed;

    compiler.concatPrecedenceExpression(node, node.object, scope, compileNode);

    if (computed)
        buffer.concatWithFormat(node, scope, "[", "left-bracket", node);
    else
        buffer.concat(".", node);

    scope.secondMemberExpression = !computed;

    // No parentheses when it is computed, '[' amd ']' are the same thing.
    if (!computed && compiler.subnodeHasPrecedence(node, node.property))
        compiler.concatParenthesizedExpression(node, scope, compileNode);
    else
        compileNode(node.property, scope);

    scope.secondMemberExpression = false;

    if (computed)
      buffer.concatWithFormat(node, scope, "]", "right-bracket");
},

Identifier: function(node, scope)
{
    var compiler = scope.compiler,
        buffer = compiler.jsBuffer,
        identifier = node.name,
        valid = scope.secondMemberExpression || scope.isPropertyKey;

    if (!valid && scope.isLocalScope())
    {
        if (scope.currentMethodType() === "-")
        {
            // If we see a standalone identifier within an instance method,
            // we have to figure out if it's an ivar
            var ivar = compiler.getIvarForClass(identifier, scope);

            if (ivar)
            {
                var localVar = scope.getLocalVar(identifier);

                if (localVar)
                {
                    compiler.addWarning(
                        node,
                        "local declaration of '%s' hides an instance variable",
                        identifier
                    );

                    compiler.addNote(ivar.node, "instance variable is declared here");
                }
                else
                {
                    scope.addIvarRef(node, identifier, ivar);
                    valid = true;
                }
            }
        }
    }

    buffer.concat(identifier, node);

    if (!valid)
        validateIdentifierReference(node, scope);
},

// Use this when there should not be a lookup to issue warnings or add 'self.' before ivars
IdentifierName: function(node, scope)
{
    scope.compiler.jsBuffer.concat(node.name, node);
},

Literal: function(node, scope)
{
    var buffer = scope.compiler.jsBuffer;

    if (node.raw && node.raw.charAt(0) === "@")
        buffer.concat(node.raw.substring(1), node);
    else
        buffer.concat(node.raw, node);
},

ArrayLiteral: function(node, scope, compileNode)
{
    var buffer = scope.compiler.jsBuffer;

    buffer.concatFormat(node, scope, "before");
    buffer.concat("objj_msgSend(objj_msgSend(CPArray, \"alloc\"), ", true);

    if (node.elements.length)
        buffer.concat("\"initWithObjects:count:\", [", node);
    else
        buffer.concat("\"init\")", node);

    if (node.elements.length)
    {
        for (var i = 0; i < node.elements.length; i++)
        {
            var element = node.elements[i];

            if (i > 0)
                buffer.concat(", ");

            compileNode(element, scope);
        }

        buffer.concat("], " + node.elements.length + ")");
    }
},

DictionaryLiteral: function(node, scope, compileNode)
{
    var buffer = scope.compiler.jsBuffer;

    if (node.keys.length)
    {
        buffer.concat("objj_msgSend(objj_msgSend(CPDictionary, \"alloc\"), \"initWithObjectsAndKeys:\"", node);

        for (var i = 0; i < node.keys.length; i++)
        {
            var key = node.keys[i],
                value = node.values[i];

            buffer.concat(", ");
            compileNode(value, scope);
            buffer.concat(", ");
            compileNode(key, scope);
        }

        buffer.concat(")");
    }
    else
    {
        buffer.concat("objj_msgSend(objj_msgSend(CPDictionary, \"alloc\"), \"init\")", node);
    }
},

ImportStatement: function(node, scope)
{
    var buffer = scope.compiler.jsBuffer,
        isLocal = node.isLocal;

    buffer.concat(util.format("objj_executeFile(\"%s\", %s)", node.filename.value, isLocal ? "YES" : "NO"), node);
},

ClassDeclaration: function(node, scope, compileNode)
{
    var compiler = scope.compiler,
        buffer = compiler.jsBuffer,
        className = node.classname.name,
        classScope = new Scope(scope);

    compiler.imBuffer = new StringBuffer(compiler.options.sourceMap, compiler.sourcePath);
    compiler.cmBuffer = new StringBuffer(compiler.options.sourceMap, compiler.sourcePath);

    var result = compiler.declareClass(node),
        classDef = result.classDef,
        comment = result.comment,
        protocols = node.protocols;

    if (protocols)
    {
        for (var i = 0; i < protocols.length; i++)
            buffer.concat(
                ClassDef.protocolTemplate({
                    var: i === 0 ? "var " : "",
                    name: protocols[i].name
                }).indent(),
                protocols[i]
            );
    }

    classScope.classDef = classDef;
    compiler.currentSuperClass = util.format("objj_getClass(\"%s\").super_class", className);
    compiler.currentSuperMetaClass = util.format("objj_getMetaClass(\"%s\").super_class", className);

    // We must make a new class object for our class definition if it isn't a category
    if (!node.categoryname)
        buffer.concat("objj_registerClassPair($the_class);");

    var haveAccessors = false;

    // Now we add all ivars
    if (node.ivardeclarations && node.ivardeclarations.length > 0)
        haveAccessors = compiler.addIvars(node, compileNode, scope, classDef, classScope);

    // We will store the classDef first after accessors are done so we don't get a duplicate class error
    compiler.classDefs[className] = classDef;

    var bodyNodes = node.body;

    // Add methods and other statements
    for (var i = 0; i < bodyNodes.length; i++)
        compileNode(bodyNodes[i], classScope);

    // Add instance methods
    var haveMethods = !compiler.imBuffer.isEmpty() || haveAccessors;

    if (haveMethods)
        buffer.concat("\n\n// Instance methods\nclass_addMethods($the_class,\n[".indent());

    if (!compiler.imBuffer.isEmpty())
        buffer.concatBuffer(compiler.imBuffer);

    if (haveAccessors)
        compiler.generateAccessors(node, classDef);

    if (haveMethods)
        buffer.concat("\n]);".indent());

    // Add class methods
    if (!compiler.cmBuffer.isEmpty())
    {
        buffer.concat("\n\n// Class methods\nclass_addMethods($the_class.isa,\n[".indent());
        buffer.concatBuffer(compiler.cmBuffer);
        buffer.concat("\n]);".indent());
    }

    buffer.concat("\n// @end: " + comment);

    // If the class conforms to protocols check self all required methods are implemented
    if (protocols)
        compiler.checkProtocolConformance(node, classDef, protocols);
},

ProtocolDeclaration: function(node, scope, compileNode)
{
    var compiler = scope.compiler,
        buffer = compiler.jsBuffer,
        protocolName = node.protocolname.name,
        protocolDef = compiler.getProtocolDef(protocolName),
        protocols = node.protocols,
        protocolScope = new Scope(scope),
        inheritedProtocols = [];

    if (protocolDef)
        throw compiler.syntaxError("Duplicate protocol: " + protocolName, node.protocolname);

    compiler.imBuffer = new StringBuffer(compiler.options.sourceMap, compiler.sourcePath);
    compiler.cmBuffer = new StringBuffer(compiler.options.sourceMap, compiler.sourcePath);

    var inheritedProtocolDeclarations = [],
        inheritedProtocolList;

    if (protocols)
    {
        inheritedProtocolList = [];

        for (var i = 0; i < protocols.length; i++)
        {
            var protocol = protocols[i],
                inheritedProtocolName = protocol.name,
                inheritedProtocolDef = compiler.getProtocolDef(inheritedProtocolName);

            if (!inheritedProtocolDef)
                throw compiler.syntaxError(util.format("Undefined protocol: %s", inheritedProtocolName), protocol);

            inheritedProtocolDeclarations.push(
                ProtocolDef.inheritedDeclarationTemplate(
                {
                    var: i === 0 ? "\nvar " : "",
                    name: inheritedProtocolName
                }).indent()
            );
            inheritedProtocols.push(inheritedProtocolDef);
            inheritedProtocolList.push(inheritedProtocolName);
        }

        inheritedProtocolList = " <" + inheritedProtocolList.join(", ") + ">";
    }
    else
        inheritedProtocolList = "";

    var comment = util.format("@protocol %s%s", protocolName, inheritedProtocolList);
    buffer.concat(ProtocolDef.declarationTemplate({ comment: comment, name: protocolName }), node);

    if (inheritedProtocolDeclarations.length > 0)
        buffer.concat(inheritedProtocolDeclarations.join("\n"), node);

    protocolDef = new ProtocolDef(node, protocolName, inheritedProtocols);
    compiler.protocolDefs[protocolName] = protocolDef;
    protocolScope.protocolDef = protocolDef;

    var requiredMethods = node.required;

    if (requiredMethods && requiredMethods.length > 0)
    {
        // We only add the required methods
        for (var i = 0; i < requiredMethods.length; i++)
            compileNode(requiredMethods[i], protocolScope);
    }

    // Add instance methods
    if (!compiler.imBuffer.isEmpty())
    {
        buffer.concat("protocol_addMethodDescriptions($the_protocol,\n[");
        buffer.concatBuffer(compiler.imBuffer);
        buffer.concat("\n],\ntrue, true);");
    }

    // Add class methods
    if (!compiler.cmBuffer.isEmpty())
    {
        buffer.concat("protocol_addMethodDescriptions($the_protocol,\n[");
        buffer.concatBuffer(compiler.cmBuffer);
        buffer.concat("\n],\ntrue, false);");
    }

    buffer.concat("\n// @end: " + comment);
},

IvarDeclaration: function(node, scope, compileNode)
{
    var buffer = scope.compiler.jsBuffer;

    if (node.outlet)
        buffer.concat("@outlet ");

    compileNode(node.ivartype, scope, "IdentifierName");
    buffer.concat(" ");
    compileNode(node.id, scope, "IdentifierName");

    if (node.accessors)
        buffer.concat(" @accessors");
},

MethodDeclaration: function(node, scope, compileNode)
{
    var compiler = scope.compiler,
        saveJSBuffer = compiler.jsBuffer,
        methodScope = new Scope(scope),
        isInstanceMethod = node.methodtype === "-",
        nodeArguments = node.arguments,
        returnType = node.returntype,
        // Return type is 'id' as default except if it is an action declared method, then it's 'void'
        noReturnType = node.action ? "void" : "id",
        types = [returnType ? returnType.name : noReturnType],
        returnTypeProtocols = returnType ? returnType.protocols : null;

    if (returnTypeProtocols)
    {
        for (var i = 0; i < returnTypeProtocols.length; i++)
        {
            var returnTypeProtocol = returnTypeProtocols[i];

            if (!compiler.getProtocolDef(returnTypeProtocol.name))
                compiler.addWarning(returnTypeProtocol, "undefined protocol: '%s'", returnTypeProtocol.name);
        }
    }

    // Temporarily swap the compiler's main buffer for the method buffer
    // so the methods can be appended to the main buffer later.
    compiler.jsBuffer = isInstanceMethod ? compiler.imBuffer : compiler.cmBuffer;

    var selector = compiler.compileMethod(node, scope, compileNode, methodScope, nodeArguments, types);

    // Restore the main buffer
    compiler.jsBuffer = saveJSBuffer;

    // Add the method to the class or protocol definition
    var def = scope.classDef,
        alreadyDeclared;

    // But first, if it is a class definition check if it is declared in the superclass or interface declaration
    if (def)
        alreadyDeclared = isInstanceMethod ? def.getInstanceMethod(selector) : def.getClassMethod(selector);
    else
        def = scope.protocolDef;

    if (!def)
        compiler.addInternalError(node, "MethodDeclaration without Implementation or Protocol");

    if (!alreadyDeclared)
    {
        var protocols = def.protocols;

        if (protocols)
        {
            for (var i = 0; i < protocols.length; i++)
            {
                var protocol = protocols[i];

                alreadyDeclared = isInstanceMethod ? protocol.getInstanceMethod(selector) : protocol.getClassMethod(selector);

                if (alreadyDeclared)
                    break;
            }
        }
    }

    if (alreadyDeclared)
        checkMethodOverride(compiler, node, nodeArguments, types, returnType, alreadyDeclared, selector);

    var methodDef = new MethodDef(node, selector, types);

    if (isInstanceMethod)
        def.addInstanceMethod(methodDef);
    else
        def.addClassMethod(methodDef);
},

MessageSendExpression: function(node, scope, compileNode)
{
    var compiler = scope.compiler,
        buffer = compiler.jsBuffer,
        useTempVar = false,
        receiverIsNotSelf = false,
        nodeObjectString;

    if (node.superObject)
    {
        var superclass = scope.currentMethodType() === "+" ? compiler.currentSuperMetaClass : compiler.currentSuperClass;
        buffer.concat(util.format("objj_msgSendSuper({ receiver: self, super_class: %s }", superclass), node);
    }
    else
    {
        // If the receiver is not an identifier or an ivar that should have 'self.' in front,
        // we need to assign it to a temporary variable.
        // If the receiver is 'self', we assume it will never be nil and remove that test.
        var isIvar = scope.currentMethodType() === "-" &&
                compiler.getIvarForClass(node.object.name, scope) !== null &&
                !scope.getLocalVar(node.object.name);

        useTempVar = node.object.type !== "Identifier" || isIvar;

        // We cache the result of compiling node.object, otherwise it potentially
        // could be compiled 3 times.
        var nodeBuffer = new StringBuffer(compiler.options.sourceMap, compiler.sourcePath);

        // If node.object is an identifier, it's the receiver
        if (node.object.type === "Identifier")
            scope.receiver = true;

        compiler.jsBuffer = nodeBuffer;
        compileNode(node.object, scope);
        compiler.jsBuffer = buffer;

        nodeObjectString = nodeBuffer.toString();
        delete scope.receiver;

        if (useTempVar)
        {
            receiverIsNotSelf = true;

            if (scope.hasOwnProperty("receiverLevel"))
            {
                ++scope.receiverLevel;

                if (scope.maxReceiverLevel < scope.receiverLevel)
                    scope.maxReceiverLevel = scope.receiverLevel;
            }
            else
            {
                scope.receiverLevel = 1;
                scope.maxReceiverLevel = 1;
            }

            buffer.concat(util.format(
                "((___r%d = %s), ___r%d === null ? null : ___r%d",
                scope.receiverLevel,
                nodeObjectString,
                scope.receiverLevel,
                scope.receiverLevel
            ));
        }
        else
        {
            var name = node.object.name,
                localVar = scope.getLocalVar(name);

            if (name === "self")
                receiverIsNotSelf = !localVar || !localVar.scope || localVar.scope.assignmentToSelf;
            else
                receiverIsNotSelf = !!localVar || !compiler.getClassDef(name);

            if (receiverIsNotSelf)
                buffer.concat("(" + nodeObjectString + " == null ? null : ");

            buffer.concat(nodeObjectString);
        }

        buffer.concat(".isa.objj_msgSend");
    }

    var selectors = node.selectors,
        nodeArguments = node.arguments,
        firstSelector = selectors[0],
        // There is always at least one selector
        selector = firstSelector ? firstSelector.name : "",
        parameters = node.parameters;

    if (!node.superObject)
    {
        var parameterCount = nodeArguments.length;

        if (node.parameters)
            parameterCount += node.parameters.length;

        if (parameterCount < 4)
            buffer.concat(String(parameterCount));

        if (useTempVar)
            buffer.concat("(___r" + scope.receiverLevel);
        else
            buffer.concat("(" + nodeObjectString);
    }

    // Assemble the selector
    for (var i = 0; i < nodeArguments.length; i++)
    {
        if (i === 0)
            selector += ":";
        else
            selector += (selectors[i] ? selectors[i].name : "") + ":";
    }

    buffer.concat(", \"" + selector + "\"");

    for (var i = 0; i < nodeArguments.length; i++)
    {
        buffer.concat(", ");
        compileNode(nodeArguments[i], scope);
    }

    if (parameters)
    {
        for (var i = 0; i < parameters.length; i++)
        {
            buffer.concat(", ");
            compileNode(parameters[i], scope);
        }
    }

    if (!node.superObject)
    {
        if (receiverIsNotSelf)
            buffer.concat(")");

        if (useTempVar)
            --scope.receiverLevel;
    }

    buffer.concat(")");
},

SelectorLiteralExpression: function(node, scope)
{
    scope.compiler.jsBuffer.concat(util.format("sel_getUid(\"%s\")", node.selector), node);
},

ProtocolLiteralExpression: function(node, scope, compileNode)
{
    var buffer = scope.compiler.jsBuffer;

    buffer.concat("objj_getProtocol(\"", node);
    compileNode(node.id, scope, "IdentifierName");
    buffer.concat("\")");
},

Reference: function(node, scope)
{
    var buffer = scope.compiler.jsBuffer;

    buffer.concat("function(__input)\n" + referenceTemplate({ name: node.element.name }).indent(), node);
},

Dereference: function(node, scope, compileNode)
{
    var compiler = scope.compiler,
        buffer = compiler.jsBuffer;

    compiler.checkCanDereference(scope, node.expr);

    compileNode(node.expr, scope);
    buffer.concat("()");
},

ClassStatement: function(node, scope)
{
    var compiler = scope.compiler,
        name = node.id.name;

    if (!compiler.getClassDef(name))
        compiler.classDefs[name] = compiler.createClass(node, name);

    scope.vars[node.id.name] = { type: "@class", node: node.id };
    compiler.jsBuffer.concat("// @class " + name);
},

GlobalStatement: function(node, scope)
{
    scope.rootScope().vars[node.id.name] = { type: "@global", node: node.id };
    scope.compiler.jsBuffer.concat("// @global " + node.id.name);
},

/*eslint-disable */

PreprocessStatement: function(node, scope)  // jshint ignore:line
{
}
});  // var codeGenerator = walk.make()