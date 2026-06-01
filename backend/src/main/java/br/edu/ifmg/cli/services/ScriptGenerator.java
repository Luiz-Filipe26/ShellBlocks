package br.edu.ifmg.cli.services;

import java.util.regex.Pattern;
import java.util.stream.Collectors;
import br.edu.ifmg.cli.models.ast.*;

public class ScriptGenerator {

	private static final Pattern SAFE_ARGUMENT_PATTERN = Pattern.compile("^[a-zA-Z0-9._/-]+$");

	public String generate(AstNode rootNode) {
		if (rootNode == null)
			throw new IllegalArgumentException("AST não pode ser nula");
		return dispatch(rootNode);
	}

	private String dispatch(AstNode node) {
		if (node == null)
			return "";
		return switch (node.type()) {
		case AstVocabulary.Nodes.SCRIPT -> generateScript(node);
		case AstVocabulary.Nodes.COMMAND -> generateCommand(node);
		case AstVocabulary.Nodes.CONTROL -> generateControl(node);
		case AstVocabulary.Nodes.OPERATOR -> generateOperator(node);
		case AstVocabulary.Nodes.OPTION -> generateOption(node);
		case AstVocabulary.Nodes.OPERAND -> generateOperand(node);
		default -> "";
		};
	}

	private String generateControl(AstNode node) {
		if (node.controlConfig() == null)
			return "";

		var controlConfig = node.controlConfig();
		var sb = new StringBuilder(node.name());

		for (var slot : controlConfig.slots()) {
			var parameterOpt = node.getParameter(slot.key());

			if (parameterOpt.isPresent()) {
				var parameter = parameterOpt.get();
				String content = renderParameter(parameter, "\n");

				if (content.isBlank() && !slot.obligatory())
					continue;

				if (slot.breakLineBefore()) {
					if (sb.length() > 0 && sb.charAt(sb.length() - 1) != '\n') {
						sb.append("\n");
					}
				} else {
					ensureSpaceSeparator(sb);
				}

				if (slot.syntaxPrefix() != null) {
					sb.append(slot.syntaxPrefix());
				}

				if (parameter.isContainer()) {
					sb.append("\n").append(indent(content));
				} else {
					ensureSpaceSeparator(sb);
					sb.append(content);
				}
			}
		}

		if (controlConfig.syntaxEnd() != null) {
			if (sb.length() > 0 && sb.charAt(sb.length() - 1) != '\n') {
				sb.append("\n");
			}
			sb.append(controlConfig.syntaxEnd());
		}

		return sb.toString();
	}

	private void ensureSpaceSeparator(StringBuilder sb) {
		if (sb.length() > 0) {
			char lastChar = sb.charAt(sb.length() - 1);
			if (lastChar != '\n' && lastChar != ' ') {
				sb.append(" ");
			}
		}
	}

	private String generateScript(AstNode node) {
		return node.parameters().stream().map(p -> renderParameter(p, "\n")).filter(s -> !s.isBlank())
				.collect(Collectors.joining("\n"));
	}

	private String generateCommand(AstNode node) {
		var sb = new StringBuilder(node.name());

		node.getParameter(AstVocabulary.Keys.OPTIONS).ifPresent(p -> {
			String val = renderParameter(p, " ");
			if (!val.isBlank())
				sb.append(" ").append(val);
		});

		node.getParameter(AstVocabulary.Keys.OPERANDS).ifPresent(p -> {
			String val = renderParameter(p, " ");
			if (!val.isBlank())
				sb.append(" ").append(val);
		});

		return sb.toString();
	}

    private String generateOperator(AstNode node) {
        if (node.operatorConfig() == null)
            return "";

        var sb = new StringBuilder();
        var config = node.operatorConfig();

        for (var slot : config.slots()) {
            node.getParameter(slot.key()).ifPresent(parameter -> {
                String content;
                if (parameter.isContainer()) {
                    content = renderChildren(parameter, "\n");
                } else {
                    String rawValue = parameter.value();
                    if (rawValue == null || rawValue.isBlank()) return;
                    content = quoteArgumentIfUnsafe(rawValue);
                }

                if (content.isBlank())
                    return;

                if (sb.length() > 0)
                    sb.append(" ");

                if (slot.symbol() != null) {
                    if (AstVocabulary.Values.PLACEMENT_BEFORE.equals(slot.symbolPlacement())) {
                        sb.append(slot.symbol()).append(" ").append(content);
                    } else {
                        sb.append(content).append(" ").append(slot.symbol());
                    }
                } else {
                    sb.append(content);
                }
            });
        }
        return sb.toString();
    }

	private String generateOption(AstNode node) {
		String flag = node.getParameter(AstVocabulary.Keys.FLAG).map(AstParameter::value).orElse("");
		String value = node.getParameter(AstVocabulary.Keys.VALUE).map(AstParameter::value).orElse("");
		var sb = new StringBuilder();
		if (!flag.isBlank()) {
			sb.append(flag);
			if (!value.isBlank())
				sb.append(" ").append(quoteArgumentIfUnsafe(value));
		}
		return sb.toString();
	}

	private String generateOperand(AstNode node) {
		return node.getParameter(AstVocabulary.Keys.VALUE).map(AstParameter::value).map(this::quoteArgumentIfUnsafe)
				.orElse("");
	}

	private String renderParameter(AstParameter parameter, String separator) {
		if (parameter.isContainer()) {
			return renderChildren(parameter, separator);
		}
		return parameter.value();
	}

	private String renderChildren(AstParameter parameter, String separator) {
		return parameter.children().stream().map(this::dispatch).filter(rendered -> !rendered.isBlank())
				.collect(Collectors.joining(separator));
	}

	private String quoteArgumentIfUnsafe(String rawArgument) {
		if (rawArgument == null || rawArgument.isEmpty())
			return "''";
		if (SAFE_ARGUMENT_PATTERN.matcher(rawArgument).matches())
			return rawArgument;
		return "'" + rawArgument.replace("'", "'\\''") + "'";
	}

	private String indent(String code) {
		return code.lines().map(line -> "  " + line).collect(Collectors.joining("\n"));
	}
}
