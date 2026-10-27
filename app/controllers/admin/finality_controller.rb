module Admin
  # The Finality ship-early event: who shipped on each bonus day, what their
  # bonus came to, and the raffle pool. Rules live in app/models/finality.rb.
  class FinalityController < Admin::ApplicationController
    def show
      authorize :finality

      @ship_events = Finality.ships.to_a
      @raffle_entry_ids = Finality.raffle_entry_ids(@ship_events)
      @days = Finality::BONUS_RATES.map do |day, rate|
        on_day = @ship_events.select { |ship_event| Finality.ship_day(ship_event) == day }
        { day: day, rate: rate, ships: on_day.size, people: on_day.filter_map { |ship_event| ship_event.payout_recipient&.id }.uniq.size }
      end
      @bonus_paid = @ship_events.sum { |ship_event| Finality.bonus_entry(ship_event)&.amount.to_i }
      @unpaid_count = @ship_events.count { |ship_event| Finality.bonus_for(ship_event).to_i.positive? && Finality.bonus_entry(ship_event).nil? }
    end

    def award
      authorize :finality

      awarded = Finality.award_missing!
      ::PaperTrail::Version.create!(
        item_type: "User",
        item_id: current_user.id,
        event: "finality_bonus_award",
        whodunnit: current_user.id,
        object_changes: { awarded: awarded }.to_json
      )

      redirect_to admin_finality_path, notice: "Finality bonuses awarded: #{awarded}."
    end

    def sync
      authorize :finality

      Airtable::FinalitySyncJob.perform_later
      redirect_to admin_finality_path, notice: "Airtable sync queued."
    end
  end
end
