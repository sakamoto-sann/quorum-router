#!/usr/bin/env ruby
# frozen_string_literal: true

require "pathname"
require "tmpdir"
require "yaml"

PINNED_ACTION = /\A[0-9a-f]{40}\z/


def action_targets(workflow)
  return [] unless workflow.is_a?(Hash)

  jobs = workflow["jobs"]
  return [] unless jobs.is_a?(Hash)

  jobs.values.flat_map do |job|
    next [] unless job.is_a?(Hash)

    targets = []
    targets << job["uses"] if job.key?("uses")
    steps = job["steps"]
    if steps.is_a?(Array)
      steps.each do |step|
        targets << step["uses"] if step.is_a?(Hash) && step.key?("uses")
      end
    end
    targets
  end
end


def parse_workflow(path)
  YAML.safe_load(path.read, permitted_classes: [], permitted_symbols: [], aliases: false)
end


def check_paths(paths)
  failures = []
  paths.sort.each do |path|
    action_targets(parse_workflow(path)).each do |target|
      unless target.is_a?(String)
        failures << "#{path}: uses value must be a string"
        next
      end
      next if target.start_with?("./")

      action, separator, ref = target.rpartition("@")
      unless separator == "@" && !action.empty? && PINNED_ACTION.match?(ref)
        failures << "#{path}: external action ref is not a 40-character commit SHA"
      end
    end
  rescue Psych::Exception => error
    failures << "#{path}: invalid YAML: #{error.message.lines.first.strip}"
  end
  failures
end


def self_test!
  Dir.mktmpdir do |directory|
    root = Pathname(directory)
    floating = root / "floating.yml"
    floating.write(<<~YAML)
      jobs:
        test:
          env:
            uses: not-an-action
          steps:
            - "uses": actions/checkout@v4
            - { uses: denoland/setup-deno@v2 }
        reusable:
          uses: owner/repository/.github/workflows/reusable.yml@main
    YAML
    raise "pin checker missed valid floating-ref YAML forms" if check_paths([floating]).length != 3

    pinned = root / "pinned.yml"
    pinned.write(<<~YAML)
      jobs:
        test:
          steps:
            - uses: actions/checkout@#{"a" * 40}
            - uses: ./local-action
    YAML
    raise "pin checker rejected pinned or local actions" unless check_paths([pinned]).empty?
  end
end

self_test!
root = Pathname(__dir__).parent
workflows = (root / ".github" / "workflows").children.select do |path|
  [".yml", ".yaml"].include?(path.extname)
end
failures = check_paths(workflows)
if failures.empty?
  puts "All external GitHub Actions references are pinned to commit SHAs."
  exit 0
end
warn failures.join("\n")
exit 1
