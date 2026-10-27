# Mirrors every Finality ship into the `_finality` table: who shipped what on
# which day, the bonus rate, payout and bonus, and the raffle pool. The window
# is a few hundred ships at most, so each run upserts all of them; the rows
# fill in as ships get certified and paid.
class Airtable::FinalitySyncJob < ApplicationJob
  queue_as :literally_whenever

  retry_on Norairrecord::Error, wait: :polynomially_longer, attempts: 3 do |job, error|
    Rails.logger.error("[#{job.class.name}] Failed after retries: #{error.message}")
  end

  def perform
    ship_events = Finality.ships.to_a
    return if ship_events.empty?

    raffle_entry_ids = Finality.raffle_entry_ids(ship_events)
    records = ship_events.map { |ship_event| table.new(field_mapping(ship_event, raffle_entry_ids)) }

    table.batch_upsert(records, "star_id")
  end

  private

  def field_mapping(ship_event, raffle_entry_ids)
    post = ship_event.post
    user = post&.user
    {
      "star_id" => ship_event.id.to_s,
      "ship_day" => Finality.ship_day(ship_event)&.iso8601,
      "shipped_at" => post&.created_at,
      "bonus_rate" => Finality.rate_for(ship_event),
      "project_id" => post&.project_id&.to_s,
      "project_title" => post&.project&.title,
      "user_id" => user&.id&.to_s,
      "slack_id" => user&.slack_id,
      "display_name" => user&.display_name,
      "certification_status" => ship_event.certification_status,
      "payout" => ship_event.payout,
      "bonus" => Finality.bonus_entry(ship_event)&.amount,
      "raffle_entry" => raffle_entry_ids.include?(ship_event.id),
      "synced_at" => Time.now
    }
  end

  def table
    @table ||= Norairrecord.table(
      Rails.application.credentials&.airtable&.api_key || ENV["AIRTABLE_API_KEY"],
      Rails.application.credentials&.airtable&.base_id || ENV["AIRTABLE_BASE_ID"],
      "_finality"
    )
  end
end
