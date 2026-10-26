# frozen_string_literal: true

# What's on clearance right now, or next, for a set of shop items. Shared by
# the shop's clearance banner and the home page countdown so they agree.
class Shop::ClearanceSale
  def initialize(items)
    @live = items.select(&:on_sale?)
    @upcoming = items.select(&:sale_upcoming?)
  end

  def live?
    @live.any?
  end

  def any?
    live? || next_starts_at.present?
  end

  def title
    names = (live? ? @live : next_sale_items).filter_map(&:sale_name).uniq
    names.any? ? names.to_sentence : "Clearance sale"
  end

  def top_percentage
    (live? ? @live.map(&:current_sale_percentage) : next_sale_items.map(&:sale_percentage)).max
  end

  # When the first live sale ends, or when the next one starts.
  def countdown_to
    live? ? @live.filter_map(&:sale_ends_at).min : next_starts_at
  end

  def decaying?
    @live.any?(&:sale_decays?)
  end

  # A random pictured item from the current (or next) sale.
  def featured_item
    @featured_item ||= (live? ? @live : next_sale_items).select { |item| item.image.attached? }.sample
  end

  private

  def next_starts_at
    @next_starts_at ||= @upcoming.map(&:sale_starts_at).min
  end

  def next_sale_items
    @upcoming.select { |item| item.sale_starts_at == next_starts_at }
  end
end
